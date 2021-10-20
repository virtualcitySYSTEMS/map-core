/* eslint-disable no-template-curly-in-string */
import Stroke from 'ol/style/Stroke.js';
import { Color, VerticalOrigin } from '@vcmap/cesium';
import Icon from 'ol/style/Icon.js';
import Style from 'ol/style/Style.js';
import OLText from 'ol/style/Text.js';
import OLImage from 'ol/style/Image.js';
import Fill from 'ol/style/Fill.js';
import Circle from 'ol/style/Circle.js';
import RegularShape from 'ol/style/RegularShape.js';

import { check, checkMaybe } from '@vcsuite/check';
import StyleItem, { StyleType } from './styleItem.js';
import {
  parseColor,
  PatternType,
  createPattern,
  getFillOptions,
  getStrokeOptions,
  getTextOptions,
  getTextFromOptions,
  getStringColor,
  getDefaultCondition,
  getDefaultVectorStyleItemOptions,
} from './styleHelpers.js';
import { getShapeFromOptions } from './shapesCategory.js';

/**
 * @typedef {Object} vcs.vcm.util.style.VectorStyleItem.Pattern
 * @property {vcs.vcm.util.style.PatternType} type
 * @property {ol/Color|ol/colorlike/ColorLike} color
 * @property {number} width
 * @property {number} size
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.VectorStyleItem.Fill
 * @property {ol/Color|ol/colorlike/ColorLike} color
 * @property {vcs.vcm.util.style.VectorStyleItem.Pattern|undefined} pattern
 * @api
 */

/**
 * This is either <b>olx.style.IconOptions</b> or <b>olx.style.CircleOptions</b>
 * @typedef {Object} vcs.vcm.util.style.VectorStyleItem.Image
 * @property {string|undefined} src
 * @property {number|ol/Size|undefined} scale
 * @property {number|undefined} opacity
 * @property {ol/Color|ol/colorlike/ColorLike|undefined} color
 * @property {ol/style/FillOptions|ol/style/Fill|undefined} fill
 * @property {ol/style/StrokeOptions|ol/style/Stroke|undefined} stroke
 * @property {number|undefined} radius
 * @property {number|undefined} points
 * @property {number|undefined} angle
 * @property {Array<number>|undefined} anchor
 * @property {vcs.vcm.util.style.VectorStyleItem.Image|undefined} circle - vcs:undocumented legacy
 * @property {vcs.vcm.util.style.VectorStyleItem.Image|undefined} icon - vcs:undocumented legacy
 * @property {string|undefined} currentImage - vcs:undocumented styleEditor
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.VectorStyleItem.Text
 * @property {string|undefined} text
 * @property {string|vcs.vcm.util.style.FontObject|undefined} font
 * @property {ol/style/FillOptions|ol/style/Fill|undefined} fill
 * @property {ol/style/StrokeOptions|ol/style/Stroke|undefined} stroke
 * @property {string|undefined} textBaseline
 * @property {number|undefined} offsetX
 * @property {number|undefined} offsetY
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.VectorStyleItem.Exclusion
 * @property {boolean} fill
 * @property {boolean} stroke
 * @property {boolean} image
 * @api
 */

/**
 * @typedef {vcs.vcm.util.style.StyleItem.Sections} vcs.vcm.util.style.VectorStyleItem.Sections
 * @property {boolean|undefined} fill
 * @property {boolean|undefined} stroke
 * @property {boolean|undefined} text
 * @property {boolean|undefined} image
 * @property {boolean|undefined} label
 * @api
 */

/**
 * @enum {number}
 * @property {number} POLYGON
 * @property {number} POLYLINE
 * @property {number} POINT
 * @memberOf vcs.vcm.util.style.VectorStyleItem.olcsGeometryType
 */
export const olcsGeometryType = {
  POLYGON: 1,
  POLYLINE: 2,
  POINT: 3,
};

/**
 * @typedef {vcs.vcm.util.style.StyleItem.Options} vcs.vcm.util.style.VectorStyleItem.Options
 * @property {vcs.vcm.util.style.VectorStyleItem.Fill|false|undefined} fill
 * @property {ol/style/StrokeOptions|false|undefined} stroke
 * @property {vcs.vcm.util.style.VectorStyleItem.Image|false|undefined} image
 * @property {vcs.vcm.util.style.VectorStyleItem.Text|undefined} text
 * @property {string|undefined} label
 * @api
 */

/**
 * Is set on a feature and is used to signal that the feature has a specific vectorStyleItem.
 * Is set by the Editor if the layerStyle is overwritten. The Vector layer assures this style is set, if
 * the style on the layer is not a DeclarativeStyle
 * @type {symbol}
 * @export
 * @memberOf vcs.vcm.util.style
 */
export const vectorStyleSymbol = Symbol('VcsVectorStyleItem');

/**
 * @class
 * @extends {vcs.vcm.util.style.StyleItem}
 * @memberOf vcs.vcm.util.style
 * @export
 * @api
 */
class VectorStyleItem extends StyleItem {
  static get className() { return 'vcs.vcm.util.style.VectorStyleItem'; }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem.Options} options
   */
  constructor(options) {
    super(options);

    this.validateOptions(options);
    /**
     * @type {vcs.vcm.util.style.VectorStyleItem.Exclusion}
     * @api
     */
    this.exclude = {
      fill: options.fill === false,
      stroke: options.stroke === false,
      image: options.image === false,
    };
    /**
     * @type {vcs.vcm.util.style.VectorStyleItem.Fill|null}
     * @private
     */
    this._fillOptions = null;
    /**
     * @type {ol/style/Fill|undefined}
     * @private
     */
    this._fill = undefined;

    /**
     * @type {ol/style/Stroke|undefined}
     * @private
     */
    this._stroke = options.stroke ? new Stroke(options.stroke) : undefined;

    /**
     * @type {ol/style/Text|undefined}
     * @private
     */
    this._text = undefined;
    if (options.text) {
      this._text = getTextFromOptions(options.text);
    }

    /**
     * @type {string|undefined}
     * @private
     */
    this._label = options.label;
    this.label = this._label;

    /**
     * @type {Cesium/Color}
     * @private
     */
    this._cesiumColor = new Color();

    /**
     * @type {ol/style/Icon|ol/style/RegularShape|undefined}
     * @private
     */
    this._image = undefined;
    if (options.image) {
      this._image = options.image.radius ?
        getShapeFromOptions({ ...options.image }) :
        new Icon(/** @type {ol/style/IconOptions} */ (options.image));
    }

    /**
     * @type {ol/style/Style|ol/style/StyleFunction}
     */
    this._style = new Style({
      image: this._image,
      stroke: this._stroke,
      text: this._text,
    });

    if (options.fill) {
      this._fillOptions = options.fill;
      this._setFill();
    } else {
      this.updateCesiumStyle();
    }
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem.Options} options
   */
  validateOptions(options) {
    const checkColor = (option) => {
      try {
        option.color = parseColor(option.color);
        check(option.color, [Number]);
        check(option.color.length, [3, 4]);
      } catch (e) {
        this.getLogger().error(e.message);
        option.color = /** @type {ol/Color} */ ([255, 255, 255, 0.4]);
      }
    };

    const checkStroke = (option) => {
      checkColor(option);
      if (!option.width) {
        this.getLogger().error('missing width for stroke, setting to 1.5');
        option.width = 1.5;
      }
    };

    if (options.fill) {
      checkColor(options.fill);
      if (options.fill.pattern) {
        checkStroke(options.fill.pattern);
        if (!(options.fill.pattern.type && Object.values(PatternType).includes(options.fill.pattern.type))) {
          this.getLogger().error(`Cannot find pattern ${options.fill.pattern.type}`);
          options.fill.pattern.type = PatternType.NWSE;
        }
      }
    }

    if (options.stroke) {
      checkStroke(options.stroke);
    }

    if (options.image) {
      // XXX Legacy...
      if (options.image.icon) {
        options.image = options.image.icon;
      } else if (options.image.circle) {
        options.image = options.image.circle;
      }

      if (!(options.image.src || options.image.radius)) {
        this.getLogger().error('missing source or label in style, setting default circle');
        options.image = {
          fill: {
            color: 'rgba(255,255,255,0.4)',
          },
          stroke: {
            color: '#3399CC',
            width: 1,
          },
          radius: 5,
        };
      }

      if (options.image.radius) {
        options.image.radius = Number(options.image.radius);
        if (!Number.isFinite(options.image.radius)) {
          this.getLogger().error('radius must be a number');
          options.image.radius = 5;
        }
        if (options.image.fill) {
          checkColor(options.image.fill);
        }
        if (options.image.stroke) {
          checkStroke(options.image.stroke);
        }
      }
    }
    // TODO text validation
  }

  /**
   * the current fill color, not the pattern
   * @type {ol/Color|null}
   * @api
   */
  get fillColor() {
    return this._fillOptions ? /** @type {ol/Color} */ (this._fillOptions.color) : null;
  }

  /**
   * the current fill color as a cesium color
   * @readonly
   * @type {Cesium/Color}
   * @api
   */
  get cesiumFillColor() {
    const fillColor = this.fillColor ? this.fillColor.slice() : null;
    if (fillColor) {
      fillColor[3] = fillColor[3] || 1;
      fillColor[3] *= 255; // cesium alpha range between 0 and 255
      // @ts-ignore
      return Color.fromBytes(...fillColor, this._cesiumColor);
    }
    return Color.RED.clone(this._cesiumColor); // TODO should not be red - transparent?
  }

  /**
   * @param {(ol/Color|ol/colorlike/ColorLike)=} color
   */
  set fillColor(color) {
    this.exclude.fill = false;
    if (this._style instanceof Style) {
      if (!color) {
        this._fillOptions = null;
        this._fill = undefined;
        this._style.setFill(this._fill);
        this.updateCesiumStyleColor(true);
      } else {
        if (!this._fillOptions) {
          this._fillOptions = { color: parseColor(color) };
        } else {
          this._fillOptions.color = parseColor(color);
        }
        this._setFill();
      }
    } else {
      this.getLogger().info('trying to set fill on a style function');
    }
  }

  /**
   * @type {vcs.vcm.util.style.VectorStyleItem.Pattern}
   * @api
   */
  get pattern() {
    return this._fillOptions && this._fillOptions.pattern ? this._fillOptions.pattern : null;
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem.Pattern} patternOptions
   */
  set pattern(patternOptions) {
    if (!this._fillOptions) {
      this.getLogger().error('Missing fill color');
      return;
    }
    if (patternOptions) {
      checkMaybe(patternOptions, {
        color: [String, [Number]],
        width: Number,
        type: Number,
        size: [Number, undefined, null],
      }, true);
      this._fillOptions.pattern = patternOptions;
    } else {
      this._fillOptions.pattern = undefined;
    }
    this._setFill();
  }

  /**
   * @type {ol/style/Stroke}
   * @api
   */
  get stroke() { return this._stroke; }

  /**
   * @param {ol/style/Stroke=} stroke
   */
  set stroke(stroke) {
    this.exclude.stroke = false;
    if (this._style instanceof Style) {
      checkMaybe(stroke, Stroke);
      this._style.setStroke(stroke);
      this._stroke = stroke;
      this.updateCesiumStyleColor(true);
    } else {
      this.getLogger().info('trying to set stroke on a style function');
    }
  }

  /**
   * @type {string}
   * @api
   */
  get label() { return this._label; }

  /**
   * @param {string} label
   */
  set label(label) {
    checkMaybe(label, String);
    if (!label) {
      this._label = undefined;
    } else {
      this._label = label;
    }
    if (this._text) {
      this._text.setText(label);
    }
  }

  /**
   * @type {ol/style/Text}
   * @api
   */
  get text() { return this._text; }

  /**
   * @param {ol/style/Text=} text
   */
  set text(text) {
    if (this._style instanceof Style) {
      checkMaybe(text, OLText);
      this._text = text;
      this._text.setText(this._label);
      this._style.setText(this._text);
    } else {
      this.getLogger().info('trying to set text on a style function');
    }
  }

  /**
   * @type {(ol/style/Icon|ol/style/RegularShape)}
   * @api
   */
  get image() { return this._image; }

  /**
   * @param {(ol/style/Icon|ol/style/RegularShape)=} image
   */
  set image(image) {
    this.exclude.image = false;
    if (this._style instanceof Style) {
      checkMaybe(image, OLImage);
      this._image = image;
      this._style.setImage(this._image);
      this.updateCesiumStyle();
    } else {
      this.getLogger().info('trying to set text on a style function');
    }
  }

  /**
   * @type {ol/style/Style|ol/style/StyleFunction}
   * @api
   */
  get style() { return this._style; }

  /**
   * @param {ol/style/Style|ol/style/StyleFunction} style
   */
  set style(style) {
    checkMaybe(style, [Style, Function]);
    if (style instanceof Style) {
      this._stroke = style.getStroke();
      this._fill = style.getFill();
      this._text = style.getText();
      this._image = /** @type {ol/style/Icon|ol/style/Circle} */ (style.getImage());
    } else {
      this._stroke = undefined;
      this._fill = undefined;
      this._text = undefined;
      this._image = undefined;
    }
    this._style = style;
    if (this._fill && this._fill.getColor()) {
      this._fillOptions = { color: parseColor(this._fill.getColor()) };
    }
    if (this._text) {
      this._text.setText(this._label);
    }
    this.updateCesiumStyle();
  }

  /**
   * @private
   */
  _setFill() {
    if (this._style instanceof Style) {
      const color = this._fillOptions.pattern ?
        createPattern(this._fillOptions) :
        this._fillOptions.color;
      if (this._fill) {
        this._fill.setColor(color);
      } else {
        this._fill = new Fill({ color });
        this._style.setFill(this._fill);
      }

      if (this._fillOptions.pattern) {
        this._fill.fallBackColor = this._fillOptions.color;
      }
      this.updateCesiumStyle();
    }
  }

  updateCesiumStyle() {
    this.updateCesiumStyleColor(true);
    this.updateCesiumStyleImage(true);
    this.updateCesiumStyleText(true);
    this._styleChanged();
  }

  /**
   *
   * @param {boolean} silent
   */
  updateCesiumStyleColor(silent) {
    const colorConditions = getDefaultCondition('olcs_color', true);
    if (this.stroke && this.stroke.getColor()) {
      colorConditions.splice(1, 0, [`\${olcs_geometryType}===${olcsGeometryType.POLYLINE}`, getStringColor(this.stroke.getColor())]);
    }
    if (this._image instanceof Circle && this._image.getFill()) {
      colorConditions.splice(
        1, 0,
        [`\${olcs_geometryType}===${olcsGeometryType.POINT}`, getStringColor(this._image.getFill().getColor())],
      );
    }
    if (this.fillColor) {
      colorConditions.splice(-1, 1, ['true', getStringColor(this.fillColor)]);
    }
    // @ts-ignore
    this.cesiumStyle.color = { conditions: colorConditions };

    if (!silent) {
      this._styleChanged();
    }
  }

  updateCesiumStyleImage(silent) {
    /* this.cesiumStyle.show = {
      conditions: [
        ['${olcs_color}===false', false],
        ['true', 'true'],
      ],
    } */
    const scaleConditions = getDefaultCondition('olcs_scale');
    const pointOutlineWidthConditions = getDefaultCondition('olcs_outlineWidth');
    const pointOutlineColorConditions = getDefaultCondition('olcs_outlineColor', true);
    const pointSizeConditions = getDefaultCondition('olcs_pointSize');
    const imageConditions = getDefaultCondition('olcs_image');
    /* commented out, because we simulate the anchorline via a line in the tileset, TODO Evaluate again
    const heightOffsetCondition = [
      [defaultExtrudedHeightCondition, '${attributes.olcs_extrudedHeight}'],
      ['true', '0'],
    ];
    const anchorLineEnabledConditions = [
      [defaultExtrudedHeightCondition, 'true'],
      ['true', 'false'],
    ];
    const anchorLineColorConditions = getDefaultCondition('olcs_anchorLineColor', true);
    */
    if (this._image) {
      if (this._image.getScale() != null) {
        scaleConditions.splice(1, 1, ['true', `${this._image.getScale()}`]);
      }
      if (this._image instanceof Circle) {
        const stroke = this._image.getStroke();
        let size = this._image.getRadius() * 2;
        if (stroke) {
          if (this._image.getStroke().getColor()) {
            pointOutlineColorConditions.splice(1, 1, ['true', getStringColor(this._image.getStroke().getColor())]);
          }
          const width = this._image.getStroke().getWidth();
          pointOutlineWidthConditions.splice(1, 1, ['true', `${width}`]);
          size -= width;
        }
        pointSizeConditions.splice(1, 1, ['true', `${size}`]);
      } else if (this._image instanceof RegularShape) {
        const dataUrl = /** @type {HTMLCanvasElement} */ (this._image.getImage(1)).toDataURL();
        imageConditions.splice(1, 1, ['true', `"${dataUrl}"`]);
      } else if (this._image instanceof Icon) {
        imageConditions.splice(1, 1, ['true', `"${this._image.getSrc()}"`]);
      }
    }
    /*
    if (this._stroke && this._stroke.getColor()) {
      anchorLineColorConditions.splice(1, 1, ['true', getStringColor(this._stroke.getColor())]);
    }
    */
    // @ts-ignore
    this.cesiumStyle.scale = { conditions: scaleConditions };
    // @ts-ignore
    this.cesiumStyle.pointOutlineWidth = { conditions: pointOutlineWidthConditions };
    // @ts-ignore
    this.cesiumStyle.pointOutlineColor = { conditions: pointOutlineColorConditions };
    // @ts-ignore
    this.cesiumStyle.pointSize = { conditions: pointSizeConditions };
    // @ts-ignore
    this.cesiumStyle.image = { conditions: imageConditions };
    /*
    // @ts-ignore
    this.cesiumStyle.heightOffset = { conditions: heightOffsetCondition };
    // @ts-ignore
    this.cesiumStyle.anchorLineEnabled = { conditions: anchorLineEnabledConditions };
    // @ts-ignore
    this.cesiumStyle.anchorLineColor = { conditions: anchorLineColorConditions };
    */
    // @ts-ignore
    this.cesiumStyle.verticalOrigin = '1';
    // @ts-ignore
    this.cesiumStyle.horizontalOrigin = '0';
    if (!silent) {
      this._styleChanged();
    }
  }

  updateCesiumStyleText(silent) {
    const fontConditions = getDefaultCondition('olcs_font');
    const labelTextConditions = getDefaultCondition('olcs_labelText');
    const labelColorConditions = getDefaultCondition('olcs_fontColor', true);
    const labelOutlineWidthConditions = getDefaultCondition('olcs_fontOutlineWidth');
    const labelOutlineColorConditions = getDefaultCondition('olcs_fontOutlineColor', true);

    if (this._text) {
      if (this._text.getFont()) {
        fontConditions.splice(1, 1, ['true', `'${this._text.getFont()}'`]);
      }
      if (this._text.getText()) {
        labelTextConditions.splice(1, 1, ['true', `'${this._text.getText()}'`]);
      }
      if (this._text.getFill() && this._text.getFill().getColor()) {
        labelColorConditions.splice(1, 1, ['true', getStringColor(this._text.getFill().getColor())]);
      }

      if (this._text.getStroke() && this._text.getStroke().getColor()) {
        labelOutlineColorConditions.splice(1, 1, ['true', getStringColor(this._text.getStroke().getColor())]);
        labelOutlineWidthConditions.splice(1, 1, ['true', `${this._text.getStroke().getWidth() || 1.25}`]);
      }
    }

    // @ts-ignore
    this.cesiumStyle.font = { conditions: fontConditions };
    // @ts-ignore
    this.cesiumStyle.labelText = { conditions: labelTextConditions };
    // @ts-ignore
    this.cesiumStyle.labelColor = { conditions: labelColorConditions };

    // @ts-ignore
    this.cesiumStyle.labelOutlineWidth = { conditions: labelOutlineWidthConditions };
    // @ts-ignore
    this.cesiumStyle.labelOutlineColor = { conditions: labelOutlineColorConditions };
    // @ts-ignore
    this.cesiumStyle.labelStyle = 'Boolean(${olcs_fontOutlineWidth}) === true ? 2 : 0';
    // @ts-ignore
    this.cesiumStyle.labelHorizontalOrigin = '0';

    let verticalOrigin = VerticalOrigin.CENTER;
    if (this._text) {
      switch (this._text.getTextBaseline()) {
        case 'top':
          verticalOrigin = VerticalOrigin.TOP;
          break;
        case 'middle':
          verticalOrigin = VerticalOrigin.CENTER;
          break;
        case 'bottom':
          verticalOrigin = VerticalOrigin.BOTTOM;
          break;
        case 'alphabetic':
          verticalOrigin = VerticalOrigin.TOP;
          break;
        case 'hanging':
          verticalOrigin = VerticalOrigin.BOTTOM;
          break;
        default:
          break;
      }
    }
    // @ts-ignore
    this.cesiumStyle.labelVerticalOrigin = verticalOrigin;

    if (!silent) {
      this._styleChanged();
    }
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem=} result
   * @returns {vcs.vcm.util.style.VectorStyleItem}
   * @api
   */
  clone(result) {
    if (result) {
      result.style = this._style instanceof Style ? this._style.clone() : this._style;
      if (this._fillOptions && this._fillOptions.color) {
        result.fillColor = /** @type {ol/Color} */ (this._fillOptions.color).slice();
        if (this._fillOptions.pattern) {
          result.pattern = { ...this._fillOptions.pattern };
        }
      }

      Object.keys(this.exclude).forEach((section) => {
        if (this.exclude[section]) {
          result.unset(section);
        }
      });
      return result;
    }
    return new VectorStyleItem(this.getOptions());
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem} result
   * @returns {vcs.vcm.util.style.VectorStyleItem}
   * @api
   */
  assign(result) {
    if (result.fillColor) {
      this.fillColor = result.fillColor.slice();
    }

    if (result.pattern) {
      this.pattern = { ...result.pattern };
    } else {
      this.pattern = undefined;
    }

    if (result.stroke) {
      this.stroke = result.stroke.clone();
    }

    if (result.image) {
      this.image = result.image.clone();
    }

    if (result.text) {
      this.text = result.text.clone();
    }

    if (result.label) {
      this.label = result.label;
    }

    Object.keys(result.exclude).forEach((section) => {
      if (result.exclude[section]) {
        this.unset(section);
      }
    });

    return this;
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem.Sections=} sections
   * @returns {vcs.vcm.util.style.VectorStyleItem.Options}
   * @api
   */
  getOptions(sections) {
    // TODO clean default, only copy relevant keys
    const options = /** @type {vcs.vcm.util.style.VectorStyleItem.Options} */ (super.getOptions(sections));
    options.type = StyleType.VECTOR;
    /** @type {vcs.vcm.util.style.VectorStyleItem.Sections} */
    const usedSections = sections || {
      fill: true,
      stroke: true,
      text: true,
      image: true,
    };

    if (usedSections.fill) {
      if (this._fillOptions) {
        options.fill = {
          color: /** @type {ol/Color} */ (parseColor(this._fillOptions.color).slice()),
        };
        if (this._fillOptions.pattern) {
          options.fill.pattern = { ...this._fillOptions.pattern };
        }
      } else if (this.exclude.fill) {
        options.fill = false;
      }
    }

    if (usedSections.stroke) {
      if (this._stroke) {
        options.stroke = getStrokeOptions(this._stroke);
      } else if (this.exclude.stroke) {
        options.stroke = false;
      }
    }

    if (usedSections.text) {
      if (this._text) {
        options.text = getTextOptions(this._text);
      }
    }

    if (usedSections.label) {
      options.label = this._label;
    }

    if (usedSections.image) { // TODO this should be nicer...
      if (this._image instanceof Icon) {
        options.image = {
          src: this._image.getSrc(), // XXX this is an issue... we dont want a data URI in the geoJSON
          scale: this._image.getScale(),
          opacity: this._image.getOpacity(),
        };
      } else if (this._image instanceof Circle) {
        options.image = {
          scale: this._image.getScale(),
          fill: getFillOptions(this._image),
          radius: this._image.getRadius(),
          stroke: this._image.getStroke() ? getStrokeOptions(this._image.getStroke()) : undefined,
        };
      } else if (this._image instanceof RegularShape) {
        options.image = {
          scale: this._image.getScale(),
          fill: getFillOptions(this._image),
          points: this._image.getPoints(),
          angle: this._image.getAngle(),
          radius: this._image.getRadius(),
          stroke: this._image.getStroke() ? getStrokeOptions(this._image.getStroke()) : undefined,
        };
      } else if (this.exclude.image) {
        options.image = false;
      }
    }

    return options;
  }

  /**
   * @param {ol/Feature} feature
   * @returns {vcs.vcm.util.style.VectorStyleItem.Options}
   */
  getOptionsForFeature(feature) {
    const type = feature.getGeometry().getType();
    const extrusion = feature.get('olcs_extrudedHeight') ||
      (feature.get('olcs_storeyHeight') && feature.get('olcs_storeyNumber'));
    const sections = {};

    if (type === 'Point' || type === 'MultiPoint') {
      if (feature[vectorStyleSymbol].label != null) {
        sections.text = true;
        sections.label = true;
      }
      sections.image = true;

      if (extrusion) {
        sections.stroke = true;
      }
    } else if (type === 'LineString' || type === 'MultiLineString') {
      sections.stroke = true;
      if (extrusion) {
        sections.fill = true;
      }
    } else if (type === 'Polygon' || type === 'MultiPolygon' || type === 'Circle') {
      sections.stroke = true;
      sections.fill = true;
    } else if (type === 'GeometryCollection') {
      sections.stroke = true;
      sections.fill = true;
      sections.image = true;
      sections.text = true;
    }
    return this.getOptions(sections);
  }

  /**
   * Exclude a section from this style. Excluded section are not returned and cannot be assigned via .assign.
   * Setting the section over a property will remove it from the excluded sections.
   * @param {string} section - one of fill, stroke, image
   * @api
   */
  unset(section) {
    check(section, Object.keys(this.exclude));
    if (section === 'fill') {
      this.fillColor = undefined;
    } else {
      this[section] = undefined;
    }
    this.exclude[section] = true;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._image = null;
    this._stroke = null;
    this._fill = null;
    this._label = null;
    this._text = null;
    this._style = null;
    super.destroy();
  }
}

export default VectorStyleItem;

/**
 * @type {vcs.vcm.util.style.VectorStyleItem}
 * @memberOf vcs.vcm.util.style.VectorStyleItem
 * @export
 */
export const defaultVectorStyle = new VectorStyleItem(getDefaultVectorStyleItemOptions());

/**
 * @param {Cesium/Color} cesiumColor
 * @returns {vcs.vcm.util.style.VectorStyleItem}
 * @export
 * @memberOf vcs.vcm.util.style.VectorStyleItem
 */
export function fromCesiumColor(cesiumColor) {
  const color = /** @type {ol/Color} */ (cesiumColor.toBytes());
  color[3] /= 255;
  return new VectorStyleItem({
    fill: { color },
    stroke: {
      color,
      width: defaultVectorStyle.stroke.getWidth(),
    },
  });
}

