import Color from '@vcmap/cesium/Source/Core/Color.js';
import ConditionsExpression from '@vcmap/cesium/Source/Scene/ConditionsExpression.js';
import Expression from '@vcmap/cesium/Source/Scene/Expression.js';
import Cesium3DTileStyle from '@vcmap/cesium/Source/Scene/Cesium3DTileStyle.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Icon from 'ol/style/Icon.js';
import Circle from 'ol/style/Circle.js';
import OLText from 'ol/style/Text.js';
import Fill from 'ol/style/Fill.js';

import StyleItem, { StyleType } from './styleItem.js';
import {
  cesiumColorToColor,
  emptyStyle,
  getDefaultCondition,
  whiteColor,
} from './styleHelpers.js';
import { originalFeatureSymbol } from '../../layer/vectorSymbols.js';

/**
 * @typedef {Object} vcs.vcm.util.style.DeclarativeStyleItem.conditions
 * @property {Array<Array<string>|string>} conditions
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.util.style.DeclarativeStyleItem.DeclarativeStyleOptions
 * @property {Object|undefined} defines
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|boolean|undefined} show
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} color
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} strokeColor - custom 2D ol condition
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} strokeWidth - custom 2D ol condition
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} scale
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} pointOutlineWidth
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} pointOutlineColor
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} pointSize
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} image - this should be an icon url
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} font - a css font string
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelStyle
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelText
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelColor
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelOutlineWidth
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelOutlineColor
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} anchorLineEnabled
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} anchorLineColor
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} heightOffset
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} verticalOrigin
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} horizontalOrigin
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelHorizontalOrigin
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} labelVerticalOrigin
 * @api
 */

/**
 * @typedef {vcs.vcm.util.style.StyleItem.Options} vcs.vcm.util.style.DeclarativeStyleItem.Options
 * @property {vcs.vcm.util.style.DeclarativeStyleItem.DeclarativeStyleOptions|undefined} declarativeStyle
 * @api
 */

/**
 * @typedef {vcs.vcm.util.style.StyleItem.Sections} vcs.vcm.util.style.DeclarativeStyleItem.Sections
 * @property {boolean|undefined} defaults
 * @property {boolean|undefined} declarativeStyle
 * @api
 */

/** @type {Cesium/Color} */
const scratchColor = new Color();

const defaultText = new OLText({
  font: '30px sans-serif',
  fill: new Fill({ color: whiteColor }),
  textAlign: 'left',
  offsetY: -15,
});

/**
 * @param {Cesium/Cesium3DTileStyle} style
 * @param {string} key
 * @param {vcs.vcm.util.style.DeclarativeStyleItem.DeclarativeStyleOptions} options
 */
function addCustomProperty(style, key, options) {
  if (options[key].conditions) {
    style[key] = new ConditionsExpression(
      options[key],
      options.defines,
    );
  } else {
    style[key] = new Expression(options[key], options.defines);
  }
}

/**
 * Style Object {@see https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/Styling}
 * @class
 * @export
 * @extends {vcs.vcm.util.style.StyleItem}
 * @api stable
 * @memberOf vcs.vcm.util.style
 */
class DeclarativeStyleItem extends StyleItem {
  static get className() { return 'vcs.vcm.util.style.DeclarativeStyleItem'; }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.Options} options
   */
  constructor(options) {
    super(options);

    const declarativeStyle = options.declarativeStyle || {};
    declarativeStyle.show = declarativeStyle.show != null ? declarativeStyle.show : true;

    /** @type {Cesium/Cesium3DTileStyle} */
    this.cesiumStyle = new Cesium3DTileStyle(declarativeStyle);

    this._style = this._styleFunction.bind(this);

    if (declarativeStyle.strokeColor) {
      addCustomProperty(this.cesiumStyle, 'strokeColor', declarativeStyle);
    }
    if (declarativeStyle.strokeWidth) {
      addCustomProperty(this.cesiumStyle, 'strokeWidth', declarativeStyle);
    }
    /** @type {vcs.vcm.util.style.DeclarativeStyleItem.DeclarativeStyleOptions} */
    this._styleOptions = declarativeStyle;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.Sections=} sections
   * @returns {vcs.vcm.util.style.DeclarativeStyleItem.Options}
   * @api
   */
  getOptions(sections) {
    const options = /** @type {vcs.vcm.util.style.DeclarativeStyleItem.Options} */ (super.getOptions(sections));
    options.type = StyleType.DECLARATIVE;
    const usedSections = sections || {
      declarativeStyle: true,
      defaults: true,
    };
    if (usedSections.declarativeStyle) {
      options.declarativeStyle = this.cesiumStyle.style;
    }

    return options;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem=} result
   * @returns {vcs.vcm.util.style.DeclarativeStyleItem}
   * @api
   */
  clone(result) {
    if (result) {
      return result.assign(this);
    }
    return new DeclarativeStyleItem(this.getOptions());
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem} styleItem
   * @returns {vcs.vcm.util.style.DeclarativeStyleItem}
   * @api
   */
  assign(styleItem) {
    this.cesiumStyle = styleItem.cesiumStyle;
    this._styleOptions = this.cesiumStyle.style;
    return this;
  }

  /**
   * @param {ol/Feature} feature
   * @returns {ol/style/Style}
   * @private
   */
  _styleFunction(feature) {
    const actualFeature = feature[originalFeatureSymbol] || feature;
    if (!this.cesiumStyle.show.evaluate(actualFeature)) {
      return emptyStyle;
    }

    const geometryType = actualFeature.getGeometry().getType();

    if (geometryType === 'Point') {
      return this._stylePoint(actualFeature);
    }
    if (geometryType === 'Polygon') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'LineString') {
      return this._styleLineString(actualFeature);
    }
    if (geometryType === 'Circle') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'MultiPoint') {
      return this._stylePoint(actualFeature);
    }
    if (geometryType === 'MultiPolygon') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'MultiLineString') {
      return this._styleLineString(actualFeature);
    }

    this.getLogger().warning(`could not style geometry type: ${geometryType}`);
    return emptyStyle;
  }

  /**
   * @param {ol/Feature} feature
   * @returns {ol/style/Style}
   * @private
   */
  _stylePolygon(feature) {
    const style = new Style({});
    const color = this.cesiumStyle.color ?
      // @ts-ignore
      this.cesiumStyle.color.evaluate(feature, scratchColor) :
      Color.WHITE;
    if (color) {
      style.setFill(new Fill({ color: cesiumColorToColor(color) }));
    }

    this._evaluateStroke(feature, style);
    return style;
  }

  /**
   * @param {ol/Feature} feature
   * @returns {ol/style/Style}
   * @private
   */
  _styleLineString(feature) {
    const style = new Style({});
    const isExtruded = feature.get('olcs_extrudedHeight') ||
      (feature.get('olcs_storeyHeight') && feature.get('olcs_storeyNumber'));
    const color = this.cesiumStyle.color ?
      // @ts-ignore
      this.cesiumStyle.color.evaluate(feature, scratchColor) :
      Color.WHITE;
    if (color) {
      if (isExtruded) {
        style.setFill(new Fill({ color: cesiumColorToColor(color) }));
      } else {
        const strokeWidth = this.cesiumStyle.strokeWidth ?
          this.cesiumStyle.strokeWidth.evaluate(feature) :
          1;
        style.setStroke(new Stroke({
          width: Number.isFinite(strokeWidth) ? strokeWidth : 1,
          color: cesiumColorToColor(color),
        }));
      }
    }

    if (isExtruded) {
      this._evaluateStroke(feature, style);
    }

    return style;
  }

  /**
   * @param {ol/Feature} feature
   * @returns {ol/style/Style}
   * @private
   */
  _stylePoint(feature) {
    const style = new Style({});

    if (this.cesiumStyle.labelText) {
      // @ts-ignore
      const text = this.cesiumStyle.labelText.evaluate(feature);
      if (text) {
        const textStyle = defaultText.clone();
        textStyle.setText(text.toString());
        if (this.cesiumStyle.font) {
          // @ts-ignore
          const font = this.cesiumStyle.font.evaluate(feature);
          if (font) {
            textStyle.setFont(font);
          }
        }
        if (this.cesiumStyle.labelColor) {
          // @ts-ignore
          const textColor = this.cesiumStyle.labelColor.evaluateColor(feature, scratchColor);
          if (textColor) {
            textStyle.getFill().setColor(cesiumColorToColor(textColor));
          }
        }
        if (this.cesiumStyle.labelOutlineColor) {
          // @ts-ignore
          const outlineColor = this.cesiumStyle.labelOutlineColor.evaluate(feature, scratchColor);
          if (outlineColor) {
            const outlineWidth = this.cesiumStyle.labelOutlineWidth ?
              // @ts-ignore
              this.cesiumStyle.labelOutlineWidth.evaluate(feature) :
              1;
            textStyle.setStroke(new Stroke({ color: cesiumColorToColor(outlineColor), width: outlineWidth }));
          }
        }
        style.setText(textStyle);
      }
    }

    if (this.cesiumStyle.image) {
      // @ts-ignore
      const src = this.cesiumStyle.image.evaluate(feature);
      if (src) {
        style.setImage(new Icon({ src }));
      }
    } else {
      const circleOptions = {
        radius: 4,
      };

      const color = this.cesiumStyle.color ?
        // @ts-ignore
        this.cesiumStyle.color.evaluate(feature, scratchColor) :
        Color.WHITE;
      circleOptions.fill = new Fill({ color: cesiumColorToColor(color) });

      if (this.cesiumStyle.pointSize) {
        // @ts-ignore
        const size = this.cesiumStyle.pointSize.evaluate(feature);
        circleOptions.radius = size / 2;
      }
      const width = this.cesiumStyle.pointOutlineWidth ?
        // @ts-ignore
        this.cesiumStyle.pointOutlineWidth.evaluate(feature) :
        0;
      if (width) {
        const pointOutlineColor = this.cesiumStyle.pointOutlineColor ?
          // @ts-ignore
          this.cesiumStyle.pointOutlineColor.evaluateColor(feature, scratchColor) :
          Color.BLACK;

        circleOptions.stroke = new Stroke({
          color: cesiumColorToColor(pointOutlineColor),
          width,
        });
        circleOptions.radius += width / 2;
      }

      style.setImage(new Circle(circleOptions));
    }

    if (this.cesiumStyle.scale && style.getImage()) {
      const scale = this.cesiumStyle.scale.evaluate(feature);
      if (Number.isFinite(scale)) {
        style.getImage().setScale(scale);
      }
    }

    this._evaluateStroke(feature, style);
    return style;
  }

  /**
   * @param {ol/Feature} feature
   * @param {ol/style/Style} style
   * @private
   */
  _evaluateStroke(feature, style) {
    if (this.cesiumStyle.strokeColor) {
      // @ts-ignore
      const strokeColor = this.cesiumStyle.strokeColor.evaluateColor(feature, scratchColor);
      if (strokeColor) {
        const strokeWidth = this.cesiumStyle.strokeWidth ?
          this.cesiumStyle.strokeWidth.evaluate(feature) :
          1;
        style.setStroke(new Stroke({
          width: Number.isFinite(strokeWidth) ? strokeWidth : 1,
          color: cesiumColorToColor(strokeColor),
        }));
      }
    }
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|boolean|undefined}
   * @api
   */
  get show() {
    return this._styleOptions.show;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|boolean|undefined} show
   */
  set show(show) {
    this._styleOptions.show = show;
    // @ts-ignore setter != getter
    this.cesiumStyle.show = show;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get color() {
    return this._styleOptions.color;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} color
   */
  set color(color) {
    this._styleOptions.color = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.color = color;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get strokeColor() {
    return this._styleOptions.strokeColor;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} color
   */
  set strokeColor(color) {
    this._styleOptions.strokeColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeColor = color;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get strokeWidth() {
    return this._styleOptions.strokeWidth;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} width
   */
  set strokeWidth(width) {
    this._styleOptions.strokeWidth = width;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeWidth = width;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get image() {
    return this._styleOptions.image;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} src
   */
  set image(src) {
    this._styleOptions.image = src;
    // @ts-ignore setter != getter
    this.cesiumStyle.image = src;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get labelText() {
    return this._styleOptions.labelText;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} text
   */
  set labelText(text) {
    this._styleOptions.labelText = text;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelText = text;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get labelColor() {
    return this._styleOptions.labelColor;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} color
   */
  set labelColor(color) {
    this._styleOptions.labelColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelColor = color;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get font() {
    return this._styleOptions.font;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} font
   */
  set font(font) {
    this._styleOptions.font = font;
    // @ts-ignore setter != getter
    this.cesiumStyle.font = font;
    this._styleChanged();
  }

  /**
   * @type {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined}
   * @api
   */
  get pointSize() {
    return this._styleOptions.pointSize;
  }

  /**
   * @param {vcs.vcm.util.style.DeclarativeStyleItem.conditions|string|undefined} pointSize
   */
  set pointSize(pointSize) {
    this._styleOptions.pointSize = pointSize;
    // @ts-ignore setter != getter
    this.cesiumStyle.pointSize = pointSize;
    this._styleChanged();
  }
}

export default DeclarativeStyleItem;

/**
 * @type {vcs.vcm.util.style.DeclarativeStyleItem}
 */
export const defaultDeclarativeStyle = new DeclarativeStyleItem({
  declarativeStyle: {
    show: true,
    color: {
      conditions: getDefaultCondition('olcs_color', true),
    },
    scale: {
      conditions: getDefaultCondition('olcs_scale'),
    },
    pointOutlineWidth: {
      conditions: getDefaultCondition('olcs_outlineWidth'),
    },
    pointOutlineColor: {
      conditions: getDefaultCondition('olcs_outlineColor', true),
    },
    pointSize: {
      conditions: getDefaultCondition('olcs_pointSize'),
    },
    image: {
      conditions: getDefaultCondition('olcs_image'),
    },
    font: {
      conditions: getDefaultCondition('olcs_font'),
    },
    labelStyle: '2',
    labelText: {
      conditions: getDefaultCondition('olcs_labelText'),
    },
    labelColor: {
      conditions: getDefaultCondition('olcs_fontColor', true),
    },
    labelOutlineWidth: {
      conditions: getDefaultCondition('olcs_fontOutlineWidth'),
    },
    labelOutlineColor: {
      conditions: getDefaultCondition('olcs_fontOutlineColor', true),
    },
    /*
    anchorLineEnabled: {
      conditions: [
        [
          defaultExtrudedHeightCondition,
          'true',
        ],
        ['true', 'false'],
      ],
    },
    anchorLineColor: {
      conditions: getDefaultCondition('olcs_anchorLineColor', true),
    },
    heightOffset: {
      conditions: [
        [
          defaultExtrudedHeightCondition,
          // eslint-disable-next-line no-template-curly-in-string
          '${attributes.olcs_extrudedHeight}',
        ],
        ['true', '0'],
      ],
    },
    */
    verticalOrigin: '1',
    horizontalOrigin: '0',
    labelHorizontalOrigin: '0',
    labelVerticalOrigin: '1',
  },
});
