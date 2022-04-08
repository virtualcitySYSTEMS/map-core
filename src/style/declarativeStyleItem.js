import { Color, ConditionsExpression, Expression, Cesium3DTileStyle } from '@vcmap/cesium';
import { is } from '@vcsuite/check';

import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Icon from 'ol/style/Icon.js';
import Circle from 'ol/style/Circle.js';
import OLText from 'ol/style/Text.js';
import Fill from 'ol/style/Fill.js';

import StyleItem from './styleItem.js';
import {
  cesiumColorToColor,
  emptyStyle,
  getDefaultCondition,
  whiteColor,
} from './styleHelpers.js';
import { originalFeatureSymbol } from '../layer/vectorSymbols.js';
import { styleClassRegistry } from '../classRegistry.js';

/**
 * @typedef {Object} DeclarativeStyleItemConditions
 * @property {Array<Array<string>|string>} conditions
 * @api
 */

/**
 * @typedef {Object} DeclarativeStyleOptions
 * @property {Object|undefined} defines
 * @property {DeclarativeStyleItemConditions|string|boolean|undefined} show
 * @property {DeclarativeStyleItemConditions|string|undefined} color
 * @property {DeclarativeStyleItemConditions|string|undefined} strokeColor - custom 2D ol condition
 * @property {DeclarativeStyleItemConditions|string|undefined} strokeWidth - custom 2D ol condition
 * @property {DeclarativeStyleItemConditions|string|undefined} scale
 * @property {DeclarativeStyleItemConditions|string|undefined} pointOutlineWidth
 * @property {DeclarativeStyleItemConditions|string|undefined} pointOutlineColor
 * @property {DeclarativeStyleItemConditions|string|undefined} pointSize
 * @property {DeclarativeStyleItemConditions|string|undefined} image - this should be an icon url
 * @property {DeclarativeStyleItemConditions|string|undefined} font - a css font string
 * @property {DeclarativeStyleItemConditions|string|undefined} labelStyle
 * @property {DeclarativeStyleItemConditions|string|undefined} labelText
 * @property {DeclarativeStyleItemConditions|string|undefined} labelColor
 * @property {DeclarativeStyleItemConditions|string|undefined} labelOutlineWidth
 * @property {DeclarativeStyleItemConditions|string|undefined} labelOutlineColor
 * @property {DeclarativeStyleItemConditions|string|undefined} anchorLineEnabled
 * @property {DeclarativeStyleItemConditions|string|undefined} anchorLineColor
 * @property {DeclarativeStyleItemConditions|string|undefined} heightOffset
 * @property {DeclarativeStyleItemConditions|string|undefined} verticalOrigin
 * @property {DeclarativeStyleItemConditions|string|undefined} horizontalOrigin
 * @property {DeclarativeStyleItemConditions|string|undefined} labelHorizontalOrigin
 * @property {DeclarativeStyleItemConditions|string|undefined} labelVerticalOrigin
 * @api
 */

/**
 * @typedef {StyleItemOptions} DeclarativeStyleItemOptions
 * @property {DeclarativeStyleOptions|undefined} declarativeStyle
 * @api
 */

/**
 * @typedef {StyleItemSections} DeclarativeStyleItemSections
 * @property {boolean|undefined} defaults
 * @property {boolean|undefined} declarativeStyle
 * @api
 */

/** @type {import("@vcmap/cesium").Color} */
const scratchColor = new Color();

const defaultText = new OLText({
  font: '30px sans-serif',
  fill: new Fill({ color: whiteColor }),
  textAlign: 'left',
  offsetY: -15,
});

/**
 * @param {import("@vcmap/cesium").Cesium3DTileStyle} style
 * @param {string} key
 * @param {DeclarativeStyleOptions} options
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
 * @extends {StyleItem}
 * @api stable
 */
class DeclarativeStyleItem extends StyleItem {
  static get className() { return 'DeclarativeStyleItem'; }

  /**
   * @param {DeclarativeStyleItemOptions} options
   */
  constructor(options) {
    super(options);

    const declarativeStyle = options.declarativeStyle || {};
    declarativeStyle.show = declarativeStyle.show != null ? declarativeStyle.show : true;

    /** @type {import("@vcmap/cesium").Cesium3DTileStyle} */
    this.cesiumStyle = new Cesium3DTileStyle(declarativeStyle);

    this._style = this._styleFunction.bind(this);

    if (declarativeStyle.strokeColor) {
      addCustomProperty(this.cesiumStyle, 'strokeColor', declarativeStyle);
    }
    if (declarativeStyle.strokeWidth) {
      addCustomProperty(this.cesiumStyle, 'strokeWidth', declarativeStyle);
    }
    /** @type {DeclarativeStyleOptions} */ // XXX is this even still needed?
    this._styleOptions = declarativeStyle;

    /** @type {Map<string,import("ol/style/Circle").default>} */
    this._circleCache = new Map();
  }

  /**
   * @type {DeclarativeStyleOptions}
   * @readonly
   */
  get styleOptions() {
    return JSON.parse(JSON.stringify(this._styleOptions));
  }

  /**
   * @returns {DeclarativeStyleItemOptions}
   * @api
   */
  toJSON() {
    const config = /** @type {DeclarativeStyleItemOptions} */ (super.toJSON());

    const styleOptions = this.cesiumStyle.ready ?
      this.cesiumStyle.style :
      this.styleOptions;

    config.declarativeStyle = Object.fromEntries(
      Object.entries(styleOptions)
        .filter(([, value]) => value != null)
        .map(([key, value]) => {
          if (is(value, Boolean)) {
            return [key, value.toString()];
          }
          return [key, value];
        }),
    );

    return config;
  }

  /**
   * @param {DeclarativeStyleItem=} result
   * @returns {DeclarativeStyleItem}
   * @api
   */
  clone(result) {
    if (result) {
      return result.assign(this);
    }
    const config = this.toJSON();
    delete config.name;
    return new DeclarativeStyleItem(config);
  }

  /**
   * @param {DeclarativeStyleItem} styleItem
   * @returns {DeclarativeStyleItem}
   * @api
   */
  assign(styleItem) {
    super.assign(styleItem);
    this._styleOptions = styleItem.cesiumStyle.ready ?
      styleItem.cesiumStyle.style :
      styleItem.styleOptions;

    this.cesiumStyle = new Cesium3DTileStyle(this._styleOptions);
    return this;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("ol/style/Style").default}
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
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("ol/style/Style").default}
   * @private
   */
  _stylePolygon(feature) {
    const style = new Style({});
    const color = this.cesiumStyle.color ?
      // @ts-ignore
      this.cesiumStyle.color.evaluate(feature, scratchColor) :
      Color.WHITE;
    if (color) {
      style.setFill(new Fill({ color: cesiumColorToColor(/** @type {import("@vcmap/cesium").Color} */ (color)) }));
    }

    this._evaluateStroke(feature, style);
    return style;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("ol/style/Style").default}
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
        style.setFill(new Fill({ color: cesiumColorToColor(/** @type {import("@vcmap/cesium").Color} */(color)) }));
      } else {
        const strokeWidth = this.cesiumStyle.strokeWidth ?
          this.cesiumStyle.strokeWidth.evaluate(feature) :
          1;
        style.setStroke(new Stroke({
          width: Number.isFinite(strokeWidth) ? strokeWidth : 1,
          color: cesiumColorToColor(/** @type {import("@vcmap/cesium").Color} */ (color)),
        }));
      }
    }

    if (isExtruded) {
      this._evaluateStroke(feature, style);
    }

    return style;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("ol/style/Style").default}
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
            textStyle.setStroke(new Stroke({
              color: cesiumColorToColor(/** @type {import("@vcmap/cesium").Color} */ (outlineColor)),
              width: outlineWidth,
            }));
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
      const color = this.cesiumStyle.color ?
        // @ts-ignore
        this.cesiumStyle.color.evaluate(feature, scratchColor) :
        Color.WHITE;

      let radius = 4;
      if (this.cesiumStyle.pointSize) {
        // @ts-ignore
        const size = this.cesiumStyle.pointSize.evaluate(feature);
        radius = size / 2;
      }
      const width = this.cesiumStyle.pointOutlineWidth ?
        // @ts-ignore
        this.cesiumStyle.pointOutlineWidth.evaluate(feature) :
        0;

      let pointOutlineColor = Color.BLACK;
      if (width) {
        if (this.cesiumStyle.pointOutlineColor) {
          // @ts-ignore
          pointOutlineColor = this.cesiumStyle.pointOutlineColor.evaluateColor(feature, scratchColor);
        }
        radius += width / 2;
      }

      const circleCacheKey = `${radius}${color}${width}${pointOutlineColor}`;
      if (!this._circleCache.has(circleCacheKey)) {
        const circleOptions = {
          radius,
          fill: new Fill({ color: cesiumColorToColor(/** @type {import("@vcmap/cesium").Color} */ (color)) }),
        };
        if (width) {
          circleOptions.stroke = new Stroke({
            color: cesiumColorToColor(pointOutlineColor),
            width,
          });
        }
        this._circleCache.set(circleCacheKey, new Circle(circleOptions));
      }
      style.setImage(this._circleCache.get(circleCacheKey));
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
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {import("ol/style/Style").default} style
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
   * @type {DeclarativeStyleItemConditions|string|boolean|undefined}
   * @api
   */
  get show() {
    return this._styleOptions.show;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|boolean|undefined} show
   */
  set show(show) {
    this._styleOptions.show = show;
    // @ts-ignore setter != getter
    this.cesiumStyle.show = show;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get color() {
    return this._styleOptions.color;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} color
   */
  set color(color) {
    this._styleOptions.color = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.color = color;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get strokeColor() {
    return this._styleOptions.strokeColor;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} color
   */
  set strokeColor(color) {
    this._styleOptions.strokeColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeColor = color;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get strokeWidth() {
    return this._styleOptions.strokeWidth;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} width
   */
  set strokeWidth(width) {
    this._styleOptions.strokeWidth = width;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeWidth = width;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get image() {
    return this._styleOptions.image;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} src
   */
  set image(src) {
    this._styleOptions.image = src;
    // @ts-ignore setter != getter
    this.cesiumStyle.image = src;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get labelText() {
    return this._styleOptions.labelText;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} text
   */
  set labelText(text) {
    this._styleOptions.labelText = text;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelText = text;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get labelColor() {
    return this._styleOptions.labelColor;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} color
   */
  set labelColor(color) {
    this._styleOptions.labelColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelColor = color;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get font() {
    return this._styleOptions.font;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} font
   */
  set font(font) {
    this._styleOptions.font = font;
    // @ts-ignore setter != getter
    this.cesiumStyle.font = font;
    this._styleChanged();
  }

  /**
   * @type {DeclarativeStyleItemConditions|string|undefined}
   * @api
   */
  get pointSize() {
    return this._styleOptions.pointSize;
  }

  /**
   * @param {DeclarativeStyleItemConditions|string|undefined} pointSize
   */
  set pointSize(pointSize) {
    this._styleOptions.pointSize = pointSize;
    // @ts-ignore setter != getter
    this.cesiumStyle.pointSize = pointSize;
    this._styleChanged();
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this._circleCache.clear();
    super.destroy();
  }
}

export default DeclarativeStyleItem;
styleClassRegistry.registerClass(DeclarativeStyleItem.className, DeclarativeStyleItem);

/**
 * @type {DeclarativeStyleItem}
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
