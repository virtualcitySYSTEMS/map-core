import Projection from './projection.js';

/**
 * @typedef {vcs.vcm.util.Projection.Options} vcs.vcm.util.Extent.Options
 * @property {ol/Extent|undefined} coordinates - if not specified, the extent of the projection is used
 * @api
 */

/**
 * checks extent validity, point extent is also valid
 * @param {ol/Extent} extent
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
 * @memberOf vcs.vcm.util
 * @api
 */
class Extent {
  /**
   * @param {vcs.vcm.util.Extent.Options=} options object
   */
  constructor(options = {}) {
    /** @type {vcs.vcm.util.Projection} */
    this.projection = new Projection({
      epsg: options.epsg,
      proj4: options.proj4,
      alias: options.alias,
    });

    /** @type {ol/Extent|null} */
    this.extent = options.coordinates || this.projection.proj.getExtent();
  }

  /**
   * @param {vcs.vcm.util.Projection} destination
   * @param {ol/Extent=} result
   * @returns {ol/Extent}
   */
  getCoordinatesInProjection(destination, result) {
    if (destination.epsg === this.projection.epsg) { // TODO aliases?!
      const extent = result ? result.splice(0, 4, ...this.extent) : this.extent.slice();
      return /** @type {ol/Extent} */ (extent);
    }
    const transformer = Projection
      .getTransformer(destination, this.projection);
    const target = result || [];
    transformer(this.extent, target, 2);
    return /** @type {ol/Extent} */ (target);
  }

  /**
   * only checks for null/nan numbers, does not check for spatial validity of the extent
   * @returns {boolean} true if extent is valid
   */
  isValid() {
    return checkExtentValidity(this.extent);
  }

  /**
   * @returns {vcs.vcm.util.Extent.Options}
   */
  getConfigObject() {
    return { coordinates: this.extent.slice(), ...this.projection.getConfigObject() };
  }

  /**
   * @returns {vcs.vcm.util.Extent}
   */
  clone() {
    return new Extent(this.getConfigObject());
  }

  /**
   * @param {vcs.vcm.util.Extent} extent
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
   * @param {vcs.vcm.util.Extent.Options} options
   * @returns {boolean}
   * @api
   */
  static validateOptions(options) {
    return Projection.validateOptions(options) && checkExtentValidity(options.coordinates);
  }

  /**
   * @type {ol/Extent}
   */
  static get WGS_84_EXTENT() { return [-180, -90, 180, 90]; }
}

export default Extent;
