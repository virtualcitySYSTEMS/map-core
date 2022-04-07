import { EasingFunction } from '@vcmap/cesium';
import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import Projection, { wgs84Projection } from './projection.js';
import VcsObject from '../vcsObject.js';
import Extent from './extent.js';

/**
 * compares two numeric properties
 * @param {number} left
 * @param {number} right
 * @param {number} epsilon
 * @returns {boolean}
 * @export
 */
export function propertyEqualsEpsilon(left, right, epsilon) {
  return Math.abs(left - right) <= epsilon;
}

/**
 * compares two angles in 360 degree range
 * @param {number} left angle in degree
 * @param {number} right angle in degree
 * @param {number} epsilon in degree
 * @returns {boolean}
 * @export
 */
export function angleEqualsEpsilon(left, right, epsilon) {
  const diff = (left - right) - Math.trunc((left - right) / 360) * 360;
  return Math.abs(diff) <= epsilon;
}


/**
 * compares two coordinates componentwise
 * @param {import("ol/coordinate").Coordinate} left
 * @param {import("ol/coordinate").Coordinate} right
 * @param {number} epsilon
 * @returns {boolean}
 * @export
 */
export function coordinateEqualsEpsilon(left, right, epsilon) {
  return left !== null && right !== null &&
    left.every((val, idx) => propertyEqualsEpsilon(val, right[idx], epsilon));
}

/**
 * @typedef {VcsObjectOptions} ViewPointOptions
 * @property {import("ol/coordinate").Coordinate|undefined} cameraPosition - ol3 coordinate array with xyz coordinates (z value is mandatory)
 * @property {import("ol/coordinate").Coordinate|undefined} groundPosition - ol3 coordinate array with xyz coordinates (z value is optional)
 * @property {number|undefined} distance - distance between the camera position and the target
 * @property {number} [heading=0] - angle between 0 and 360 degree
 * @property {number} [pitch=-90] - angle between 0 and 360 degree
 * @property {number} [roll=0] - angle between 0 and 360 degree
 * @property {boolean} [animate=false] -  if possible the switching to the new viewpoint will be animated
 * @property {number|undefined} duration - animation duration override
 * @property {string|undefined} easingFunctionName - a Cesium.EasingFunction name to use for the flight
 * @api
 */

/**
 * A Viewpoint Object
 * @class
 * @export
 * @extends {VcsObject}
 * @api stable
 */
class ViewPoint extends VcsObject {
  static get className() { return 'ViewPoint'; }

  /**
   * @param {ViewPointOptions} options
   */
  constructor(options) {
    super(options);

    /**
     * position of the camera (optional) (cameraPosition needs  x, y, and height value)
     * either a cameraPosition or a groundPosition have to be provided
     * @type {?import("ol/coordinate").Coordinate}
     * @api
     */
    this.cameraPosition = null;
    if (Array.isArray(options.cameraPosition) && options.cameraPosition.length === 3) {
      this.cameraPosition = options.cameraPosition.map(c => Number(c));
    }

    /**
     * groundPosition, point on the ground the camera looks at (optional)
     * either a cameraPosition or a groundPosition have to be provided
     * @type {?import("ol/coordinate").Coordinate}
     * @api
     */
    this.groundPosition = null;
    if (Array.isArray(options.groundPosition)) {
      this.groundPosition = options.groundPosition.map(c => Number(c));
    }

    /**
     * distance between target and camera position, only needed if a groundPosition is given
     * is used to move the cameraPosition backwards to get some distance from the ground
     * @type {?number}
     * @api
     */
    this.distance = parseNumber(options.distance, this.cameraPosition ? this.cameraPosition[2] : 1000);

    /**
     * heading, angle between 0 and 360 degree 0° = North, 90° = east ...
     * @type {number}
     * @api
     */
    this.heading = parseNumber(options.heading, 0);

    /**
     * pitch in degrees ranges -90 to 90
     * @type {number}
     * @api
     */
    this.pitch = parseNumber(options.pitch, -90);

    /**
     * roll in degrees, ranges -90 to 90
     * @type {number}
     * @api
     */
    this.roll = parseNumber(options.roll, 0);

    /**
     * animate this viewpoint when setting it on a map
     * @type {boolean}
     * @api
     */
    this.animate = parseBoolean(options.animate, false);
    /**
     * An optional duration in seconds to override durations when animating this viewpoint
     * @type {number|null}
     * @api
     */
    this.duration = options.duration || null;
    /**
     * The name of the easing function to use
     * @type {string|null}
     * @api
     */
    this.easingFunctionName = options.easingFunctionName || null;
  }

  /**
   * The current easing function
   * @type {import("@vcmap/cesium").EasingFunction.Callback|null}
   * @api
   * @readonly
   */
  get easingFunction() {
    return this.easingFunctionName ? EasingFunction[this.easingFunctionName] : null;
  }

  /**
   * @returns {ViewPointOptions} returns a options object. This object can be used to reconstruct a new viewpoint
   * @api stable
   */
  toJSON() {
    return {
      ...super.toJSON(),
      distance: this.distance,
      cameraPosition: this.cameraPosition ? this.cameraPosition.slice() : null,
      groundPosition: this.groundPosition ? this.groundPosition.slice() : null,
      heading: this.heading,
      pitch: this.pitch,
      roll: this.roll,
      animate: this.animate,
      duration: this.duration,
      easingFunctionName: this.easingFunctionName,
    };
  }

  /**
   * clones the viewpoint
   * @returns {ViewPoint} viewpoint
   * @api stable
   */
  clone() {
    return new ViewPoint(this.toJSON());
  }

  /**
   * creates a String representation of this viewpoint
   * @returns {string}
   * @api stable
   */
  toString() {
    const stringRep = `ViewPoint: [Ground:${String(this.groundPosition ? this.groundPosition : null)}]` +
      `[Camera:${String(this.cameraPosition ? this.cameraPosition : null)}]` +
      `[Distance:${this.distance}]` +
      `[heading:${this.distance}]` +
      `[pitch:${this.distance}]` +
      `[roll:${this.distance}]`;
    return stringRep;
  }

  /**
   * Creates a viewpoint based on an extent
   * @param {import("ol/extent").Extent|Extent} extent
   * @returns {?ViewPoint}
   * @api
   */
  static createViewPointFromExtent(extent) {
    const extentCoordinates = extent instanceof Extent ?
      extent.getCoordinatesInProjection(wgs84Projection) :
      extent;

    if (extentCoordinates && extentCoordinates.length === 4) {
      const minx = extentCoordinates[0];
      const miny = extentCoordinates[1];
      const maxx = extentCoordinates[2];
      const maxy = extentCoordinates[3];

      const center = [(maxx - minx) / 2 + minx, (maxy - miny) / 2 + miny];
      let distance = 0;
      const delta = Math.max(maxx - minx, maxy - miny);
      if (delta < 0.001) {
        distance = 400;
      } else {
        distance = (delta) * 300000;
      }

      return new ViewPoint({
        name: 'viewpointFromExtend',
        distance,
        groundPosition: center,
        heading: 360,
        pitch: -90,
        roll: 0,
        animate: true,
      });
    }
    return null;
  }

  /**
   * creates a new ViewPoint Object from url Paramter
   * @param {Object} urlParameter
   * @returns {ViewPoint}
   */
  static parseURLparameter(urlParameter) {
    let { cameraPosition, groundPosition } = urlParameter;
    if (cameraPosition != null) {
      cameraPosition = cameraPosition.split(',').map(c => Number(c));
    }

    if (groundPosition != null) {
      groundPosition = groundPosition.split(',').map(c => Number(c));
    }

    if (urlParameter.epsg != null) {
      const { epsg, proj4: proj4String } = urlParameter;
      const srcProjection = new Projection({ epsg, proj4: proj4String });
      const destProjection = wgs84Projection;
      if (groundPosition) {
        groundPosition = Projection.transform(destProjection, srcProjection, groundPosition);
      }
      if (cameraPosition) {
        cameraPosition = Projection.transform(destProjection, srcProjection, cameraPosition);
      }
    }

    const options = {
      cameraPosition,
      groundPosition,
      distance: Number(urlParameter.distance),
      pitch: Number(urlParameter.pitch),
      heading: Number(urlParameter.heading),
      roll: Number(urlParameter.roll),
    };

    return new ViewPoint(options);
  }

  /**
   * Checks if this Viewpoint is Valid
   * @api stable
   * @throws {InvalidArgument} on invalid viewpoint
   * @returns {boolean}
   */
  isValid() {
    const hasCamera = this.cameraPosition &&
      Array.isArray(this.cameraPosition) &&
      this.cameraPosition.length === 3 &&
      this.cameraPosition.every(position => Number.isFinite(position));
    const hasGround = this.groundPosition &&
      Array.isArray(this.groundPosition) &&
      this.groundPosition.length > 1 &&
      this.groundPosition.length < 4 &&
      this.groundPosition.every(position => Number.isFinite(position));
    if (!hasGround && !hasCamera) {
      return false;
    }
    if (!hasCamera && !Number.isFinite(this.distance)) {
      return false;
    }
    if (!Number.isFinite(this.heading)) {
      return false;
    }
    if (!Number.isFinite(this.pitch)) {
      return false;
    }
    if (!Number.isFinite(this.roll)) {
      return false;
    }
    return true;
  }

  /**
   * compares the provided Viewpoint with this viewpoint componentwise
   * @param {ViewPoint} other
   * @param {number} [epsilon=0]
   * @returns {boolean}
   */
  equals(other, epsilon = 0) {
    return other === this || (
      other !== null &&
      propertyEqualsEpsilon(other.distance, this.distance, epsilon) &&
      angleEqualsEpsilon(other.heading, this.heading, epsilon) &&
      angleEqualsEpsilon(other.pitch, this.pitch, epsilon) &&
      angleEqualsEpsilon(other.roll, this.roll, epsilon) &&
      (
        coordinateEqualsEpsilon(other.cameraPosition, this.cameraPosition, epsilon) ||
        coordinateEqualsEpsilon(other.groundPosition, this.groundPosition, epsilon)
      )
    );
  }
}

export default ViewPoint;
