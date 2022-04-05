import Projection from './projection.js';

/**
 * @typedef {Object} ExtentOptions
 * @property {string} [type]
 * @property {import("ol/extent").Extent|undefined} [coordinates] - if not specified, the extent of the projection is used
 * @property {ProjectionOptions} [projection] - if not specified the default projection is assumed
 * @api
 */

/**
 * checks extent validity, point extent is also valid
 * @param {import("ol/extent").Extent} extent
 * @returns {boolean}
 */
function checkExtentValidity(extent) {
  if (!extent || !Array.isArray(extent) || extent.length !== 4) {
    return false;
  }

  if (
    !Number.isFinite(extent[0]) ||
    !Number.isFinite(extent[1]) ||
    !Number.isFinite(extent[2]) ||
    !Number.isFinite(extent[3])
  ) {
    return false;
  }
  return extent[0] <= extent[2] && extent[1] <= extent[3];
}


/**
 * Extent Class
 * @class
 * @export
 * @api
 */
class Extent {
  /**
   * @type {string}
   */
  static get className() { return 'Extent'; }

  /**
   * @param {ExtentOptions=} options object
   */
  constructor(options = {}) {
    /** @type {Projection} */
    this.projection = new Projection(options.projection);

    /** @type {import("ol/extent").Extent|null} */
    this.extent = options.coordinates || this.projection.proj.getExtent();
  }

  /**
   * @param {Projection} destination
   * @param {import("ol/extent").Extent=} result
   * @returns {import("ol/extent").Extent}
   */
  getCoordinatesInProjection(destination, result) {
    if (destination.epsg === this.projection.epsg) { // TODO aliases?!
      const extent = result ? result.splice(0, 4, ...this.extent) : this.extent.slice();
      return /** @type {import("ol/extent").Extent} */ (extent);
    }
    const transformer = Projection
      .getTransformer(destination, this.projection);
    const target = result || [];
    transformer(this.extent, target, 2);
    return /** @type {import("ol/extent").Extent} */ (target);
  }

  /**
   * only checks for null/nan numbers, does not check for spatial validity of the extent
   * @returns {boolean} true if extent is valid
   */
  isValid() {
    return checkExtentValidity(this.extent);
  }

  /**
   * @returns {ExtentOptions}
   */
  toJSON() {
    return {
      coordinates: this.extent.slice(),
      projection: this.projection.toJSON(),
      type: Extent.className,
    };
  }

  /**
   * @returns {Extent}
   */
  clone() {
    return new Extent(this.toJSON());
  }

  /**
   * @param {Extent} extent
   * @returns {boolean}
   */
  equals(extent) {
    if (this === extent) {
      return true;
    }

    return this.isValid() &&
      extent.isValid() &&
      this.extent.every((c, i) => c === extent.extent[i]) &&
      this.projection.equals(extent.projection);
  }

  /**
   * validates extent options, checks for valid projection and the geometry of the given coordinates.
   * The Coordinate extent is also valid if its a point extent
   * @param {ExtentOptions} options
   * @returns {boolean}
   * @api
   */
  static validateOptions(options) {
    return Projection.validateOptions(options.projection || {}) && checkExtentValidity(options.coordinates);
  }

  /**
   * @type {import("ol/extent").Extent}
   */
  static get WGS_84_EXTENT() { return [-180, -90, 180, 90]; }
}

export default Extent;
