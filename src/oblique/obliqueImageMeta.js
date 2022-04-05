import { cartesian2DDistance } from '../util/math.js';

/**
 * @typedef {Object} ObliqueImageMetaOptions
 * @property {import("ol/coordinate").Coordinate|undefined} "principal-point"
 * @property {import("ol/coordinate").Coordinate|undefined} "pixel-size"
 * @property {Array<number>|undefined} "radial-distorsion-expected-2-found"
 * @property {Array<number>|undefined} "radial-distorsion-found-2-expected"
 * @property {import("ol/size").Size} size
 * @property {import("ol/size").Size} tileSize
 * @property {Array<number>} tileResolution
 * @property {import("@vcmap/core").Projection} projection
 * @property {string} url
 * @property {import("@vcmap/cesium").CesiumTerrainProvider} [terrainProvider]
 * @property {string} name
 * @property {string|undefined} [format='jpg']
 * @api
 */


/**
 * @class
 * @export
 */
class ObliqueImageMeta {
  /**
   * @param {ObliqueImageMetaOptions} options
   */
  constructor(options) {
    /**
     * The name of the camera associated with these meta data
     * @type {string}
     * @api
     * @readonly
     */
    this.name = options.name;
    /** @type {import("ol/coordinate").Coordinate|undefined} */
    this.principalPoint = options['principal-point'];
    /** @type {import("ol/coordinate").Coordinate|undefined} */
    this.pixelSize = options['pixel-size'];
    /** @type {Array<number>|undefined} */
    this.radialE2F = options['radial-distorsion-expected-2-found'];
    /** @type {Array<number>|undefined} */
    this.radialF2E = options['radial-distorsion-found-2-expected'];
    /** @type {boolean} */
    this.hasRadial = !!(this.pixelSize && (this.radialE2F && this.radialF2E));
    /**
     * The size of the images associated with this meta data
     * @type {import("ol/size").Size}
     * @api
     */
    this.size = options.size;
    /**
     * The tile size of the images associated with this meta data
     * @type {import("ol/size").Size}
     * @api
     */
    this.tileSize = options.tileSize;
    /**
     * The tile resolutions of the images associated with this meta data
     * @type {Array<number>}
     * @api
     */
    this.tileResolution = options.tileResolution;
    /**
     * The world projection of the images associated with this meta
     * @type {import("@vcmap/core").Projection}
     * @api
     */
    this.projection = options.projection;
    /**
     * @type {string}
     * @api
     */
    this.url = options.url;
    /**
     * An optional terrain provider
     * @type {import("@vcmap/cesium").CesiumTerrainProvider|undefined}
     * @api
     */
    this.terrainProvider = options.terrainProvider;
    /**
     * @type {string}
     * @api
     */
    this.format = options.format || 'jpg';
  }

  /**
   * Removes radial distortion in image coordinates. Radial coefficients must be provided
   * @param {import("ol/coordinate").Coordinate} coordinate
   * @param {boolean=} [useF2E=false] useFound2Expected, if not true expectedToFound is used
   * @returns {import("ol/coordinate").Coordinate}
   * @api
   */
  radialDistortionCoordinate(coordinate, useF2E) {
    if (this.hasRadial && this.principalPoint) {
      const coefficientsArray = useF2E ? this.radialF2E : this.radialE2F;

      const distC2PPInMM = cartesian2DDistance(this.principalPoint, coordinate) * this.pixelSize[0];
      if (distC2PPInMM === 0) {
        return coordinate.slice();
      }
      const diffX = coordinate[0] - this.principalPoint[0];
      const diffY = coordinate[1] - this.principalPoint[1];

      // get shift value
      let shift = 0;
      for (let i = 0; i < coefficientsArray.length; ++i) {
        shift += coefficientsArray[i] * (distC2PPInMM ** i);
      }

      // get new position through spherical coordinates system - http://mathworld.wolfram.com/SphericalCoordinates.html
      const newDistInPixel = (distC2PPInMM + shift) / this.pixelSize[0];
      const angleTheta = Math.atan2(diffY, diffX);
      return [
        this.principalPoint[0] + (newDistInPixel * Math.cos(angleTheta)),
        this.principalPoint[1] + (newDistInPixel * Math.sin(angleTheta)),
      ];
    }

    return coordinate.slice();
  }
}

export default ObliqueImageMeta;
