import { Cartesian3 } from '@vcmap/cesium';
import {
  Circle,
  Fill,
  Icon,
  Stroke,
  Style,
  Image as OlImage,
} from 'ol/style.js';
import { parseEnumValue, parseNumber } from '@vcsuite/parsers';
import { getCartesianBearing } from '../util/math.js';
import { PrimitiveOptionsType } from '../layer/vectorProperties.js';
import { getStringColor, parseColor } from './styleHelpers.js';

/**
 * @typedef {Object} ArrowStyleOptions
 * @property {import("ol/color").Color|import("ol/colorlike").ColorLike} [color='#000000'] - color used to color in the line & the icon
 * @property {number} [width=1] - passed to ol.Style.Stroke
 * @property {number} [zIndex] - passed to ol.Style
 * @property {import("ol/style/Icon").Options|import("ol/style").Image} [arrowIcon] - icon options to use. if none are provided, if is attempted to derive the arrow icon from the primitive options. if providing your own icon, the color will not be options.color by default
 * @property {VectorPropertiesPrimitiveOptions} [primitiveOptions] - the default primitive options are a cylinder with a bottom radius of 1/3 its length and 0 top radius
 * @property {ArrowEnd} [end=ArrowEnd.END] - end to place the arrow head at
 */

/**
 * @enum {string}
 */
export const ArrowEnd = {
  NONE: 'none',
  BOTH: 'both',
  START: 'start',
  END: 'end',
};

/**
 * @param {VectorPropertiesPrimitiveOptions} primitiveOptions
 * @param {number} [twoDFactor=1.5]
 * @returns {string}
 * @private
 */
export function getDefaultArrowIconSrc(primitiveOptions, twoDFactor = 1.5) {
  let height = 13;
  let width = 13;
  let points = [[0, 13], [13, 13], [6, 0]];

  if (primitiveOptions.type === PrimitiveOptionsType.SPHERE) {
    const radius = Math.floor((primitiveOptions.geometryOptions?.radius ?? 1) * twoDFactor);
    return `<svg height="${radius * 2}" width="${radius * 2}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${radius}" cy="${radius}" r="${radius}" style="fill:white;" />
</svg>`;
  }

  if (
    primitiveOptions.type === PrimitiveOptionsType.BOX &&
    primitiveOptions.geometryOptions.minimum &&
    primitiveOptions.geometryOptions.maximum
  ) {
    const min = Array.isArray(primitiveOptions.geometryOptions.minimum) ?
      primitiveOptions.geometryOptions.minimum :
      Cartesian3.pack(primitiveOptions.geometryOptions.minimum, []);

    const max = Array.isArray(primitiveOptions.geometryOptions.maximum) ?
      primitiveOptions.geometryOptions.maximum :
      Cartesian3.pack(primitiveOptions.geometryOptions.maximum, []);

    width = Math.floor((max[0] - min[0]) * twoDFactor);
    height = Math.floor((max[1] - min[1]) * twoDFactor);

    points = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
  } else if (
    primitiveOptions.type === PrimitiveOptionsType.CYLINDER &&
    primitiveOptions.geometryOptions.length
  ) {
    const topRadius = Math.floor(primitiveOptions.geometryOptions.topRadius * twoDFactor);
    const bottomRadius = Math.floor(primitiveOptions.geometryOptions.bottomRadius * twoDFactor);
    const maxRadius = Math.max(topRadius, bottomRadius);

    height = Math.floor(primitiveOptions.geometryOptions.length * twoDFactor);
    width = maxRadius * 2;

    points = [
      [(width / 2) - bottomRadius, height],
      [(width / 2) + bottomRadius, height],
      [(width / 2) + topRadius, 0],
      [(width / 2) - topRadius, 0],
    ];
    if (bottomRadius === 0) {
      points.splice(1, 1);
    } else if (topRadius === 0) {
      points.splice(2, 1);
    }
  }
  return `<svg height="${height}" width="${width}" xmlns="http://www.w3.org/2000/svg"><polygon points="${points.map(p => p.join(',')).join(' ')}" style="fill:white;" /></svg>`;
}

/**
 * @returns {VectorPropertiesPrimitiveOptions}
 */
function getDefaultArrowPrimitive() {
  return {
    type: PrimitiveOptionsType.CYLINDER,
    geometryOptions: {
      length: 9,
      bottomRadius: 3,
      topRadius: 0,
    },
    offset: [0, 0, -4.3],
  };
}

/**
 * A style which renders arrow heads at the ends of a line string. This style cannot be applied to non-LineString geometries.
 * When setting this on a layer with heterogeneous geometry types, use a style function.
 * @class
 * @extends {Style}
 */
class ArrowStyle extends Style {
  /**
   * @param {ArrowStyleOptions} [options={}]
   */
  constructor(options = {}) {
    const color = options.color ?? '#000000';
    const styleOptions = {
      stroke: new Stroke({
        color,
        width: parseNumber(options.width, 1),
      }),
      zIndex: options.zIndex,
    };

    const primitiveOptions = options.primitiveOptions ?? getDefaultArrowPrimitive();
    const iconOptions = options.arrowIcon ?? {
      src: `data:image/svg+xml,${encodeURIComponent(getDefaultArrowIconSrc(primitiveOptions))}`,
      color: parseColor(color),
    };
    styleOptions.image = iconOptions instanceof OlImage ? iconOptions : new Icon(iconOptions);
    super(styleOptions);

    /**
     * @type {VectorPropertiesPrimitiveOptions}
     */
    this.primitiveOptions = primitiveOptions;
    /**
     * @type {ArrowEnd}
     */
    this.end = parseEnumValue(options.end, ArrowEnd, ArrowEnd.END);
    this.setRenderer(this._render.bind(this));
  }

  /**
   * Same as getStroke().getWidth() / getStroke().setWidth()
   * @type {number}
   */
  get width() {
    return this.getStroke().getWidth();
  }

  /**
   * @param {number} width
   */
  set width(width) {
    this.getStroke().setWidth(width);
  }

  /**
   * The color of the stroke and icon styles. Setting the color will not re-apply the icons color.
   * @type {import("ol/color").Color|import("ol/colorlike").ColorLike}
   */
  get color() {
    return this.getStroke().getColor();
  }

  /**
   * @param {import("ol/color").Color|import("ol/colorlike").ColorLike} color
   */
  set color(color) {
    this.getStroke().setColor(color);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import("ol/coordinate").Coordinate} imagePosition
   * @param {number} rotation
   * @param {number} pixelRatio
   * @private
   */
  _drawArrow(ctx, imagePosition, rotation, pixelRatio) {
    ctx.save();
    let scale = this.getImage().getScale();
    scale = Array.isArray(scale) ? scale : [scale, scale];
    ctx.setTransform(scale[0], 0, 0, scale[1], imagePosition[0], imagePosition[1]);
    ctx.rotate(Math.PI - rotation);
    const image = this.getImage().getImage(pixelRatio);
    ctx.translate(0, Math.floor(image.height / 2));
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
  }

  /**
   * @param {Array<import("ol/coordinate").Coordinate>} geom
   * @param {import("ol/render").State} e
   * @private
   */
  _render(geom, e) {
    if (e.geometry.getType() === 'LineString' && geom.length > 1) {
      const ctx = e.context;
      if (this.end !== ArrowEnd.NONE) {
        if (this.end === ArrowEnd.START || this.end === ArrowEnd.BOTH) {
          this._drawArrow(ctx, geom[0], getCartesianBearing(geom[1], geom[0]), e.pixelRatio);
        }

        if (this.end === ArrowEnd.END || this.end === ArrowEnd.BOTH) {
          this._drawArrow(ctx, geom.at(-1), getCartesianBearing(geom.at(-2), geom.at(-1)), e.pixelRatio);
        }
      }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = this.width;
      ctx.strokeStyle = getStringColor(this.color);
      ctx.beginPath();
      ctx.moveTo(geom[0][0], geom[0][1]);
      for (let i = 0; i < geom.length; i++) {
        ctx.lineTo(geom[i][0], geom[i][1]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Returns the style used to render primitives (a style with a circle image and the color of this style).
   * @returns {import("ol/style").Style}
   */
  getOlcsStyle() {
    return new Style({
      image: new Circle({
        radius: 2,
        fill: new Fill({ color: this.color }),
      }),
    });
  }

  /**
   * @returns {ArrowStyleOptions}
   * @protected
   */
  _getCloneOptions() {
    return {
      color: this.color,
      width: this.width,
      arrowIcon: this.getImage().clone(),
      zIndex: this.getZIndex(),
    };
  }

  /**
   * @returns {ArrowStyle}
   */
  clone() {
    return new ArrowStyle(this._getCloneOptions());
  }
}

export default ArrowStyle;
