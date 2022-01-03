import { Cartesian3, Cartesian4, Matrix3, Matrix4 } from '@vcmap/cesium';
import { transformCWIFC } from './helpers.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';

/**
 * @typedef {Object} ObliqueImageOptions
 * @property {!string} name
 * @property {import("@vcmap/core").ObliqueViewDirection} viewDirection
 * @property {number} viewDirectionAngle
 * @property {!Array<import("ol/coordinate").Coordinate>} groundCoordinates
 * @property {!import("ol/coordinate").Coordinate} centerPointOnGround
 * @property {!import("@vcmap/core").ObliqueImageMeta} meta
 * @property {import("@vcmap/cesium").Cartesian3|undefined} projectionCenter
 * @property {import("@vcmap/cesium").Matrix3|undefined} pToRealworld
 * @property {import("@vcmap/cesium").Matrix4|undefined} pToImage
 * @property {import("@vcmap/core").Projection|undefined} [projection]
 * @property {import("@vcmap/cesium").CesiumTerrainProvider|undefined} terrainProvider
 * @api
 */

/**
 * @class
 * @export
 */
class ObliqueImage {
  /**
   * @param {ObliqueImageOptions} options
   */
  constructor(options) {
    /**
     * Name of the image
     * @type {string}
     * @api
     */
    this.name = options.name;

    /**
     * Meta information shared across multiple images.
     * @type {import("@vcmap/core").ObliqueImageMeta}
     * @api
     */
    this.meta = options.meta;

    /**
     * viewDirection
     * @type {import("@vcmap/core").ObliqueViewDirection}
     * @api
     */
    this.viewDirection = options.viewDirection;

    /**
     * viewDirectionAngle in radians, where 0 = east, PI / 2 = north, PI = west and PI * 1.5 = south
     * @type {number|null}
     * @api
     */
    this.viewDirectionAngle = options.viewDirectionAngle;

    /**
     * The ground coordinates of the image corners (in image world projection).
     * @type {Array<import("ol/coordinate").Coordinate>}
     * @api
     */
    this.groundCoordinates = options.groundCoordinates;

    /**
     * The center point of the image in world coordinates (in image world projection).
     * @type {import("ol/coordinate").Coordinate}
     * @api
     */
    this.centerPointOnGround = options.centerPointOnGround;

    /**
     * The transformation matrix image to real world (in image world projection).
     * @type {import("@vcmap/cesium").Matrix3}
     * @api
     */
    this.pToRealworld = options.pToRealworld || null;

    /**
     * The transformation matrix real to image (in image world projection).
     * @type {import("@vcmap/cesium").Matrix4}
     */
    this.pToImage = options.pToImage || null;

    /**
     * The projection center in image world projection
     * @type {import("@vcmap/cesium").Cartesian3}
     * @api
     */
    this.projectionCenter = options.projectionCenter || null;

    /**
     * The calculated average height of an image
     * @type {number|null}
     * @private
     */
    this._averageHeight = null;
  }

  /**
   * returns the averageHeight of the image or 0 if not defined. Be sure to call calculateAverageHeight before hand.
   * @type {number}
   * @readonly
   * @api
   */
  get averageHeight() {
    return this._averageHeight != null ? this._averageHeight : 0;
  }

  /**
   * returns whether this image supports exact Coordinate transformation
   * @type {boolean}
   * @readonly
   * @api
   */
  get hasCamera() {
    return !!this.meta.principalPoint;
  }

  /**
   * @param {import("ol/coordinate").Coordinate} imageCoordinate
   * @param {number=} optAvgHeight
   * @returns {import("ol/coordinate").Coordinate}
   * @api
   */
  transformImage2RealWorld(imageCoordinate, optAvgHeight) {
    let distortedCoordinate = imageCoordinate;
    if (!this.meta.principalPoint) {
      return this._transformNoCamera(distortedCoordinate, true, optAvgHeight);
    } else if (this.meta.hasRadial) {
      distortedCoordinate = this.meta.radialDistortionCoordinate(distortedCoordinate, true);
    }

    const x = new Cartesian3(distortedCoordinate[0], this.meta.size[1] - distortedCoordinate[1], 1);
    const rayWorld = Matrix3.multiplyByVector(this.pToRealworld, x, new Cartesian3());
    const avgHeight = optAvgHeight || this.averageHeight;
    const centerPointOnGround =
      new Cartesian3(this.centerPointOnGround[0], this.centerPointOnGround[1], avgHeight);
    const w0 = Cartesian3.subtract(this.projectionCenter, centerPointOnGround, new Cartesian3());
    const a = Cartesian3.dot(Cartesian3.UNIT_Z, w0) * (-1);
    const b = Cartesian3.dot(Cartesian3.UNIT_Z, rayWorld);

    const r = a / b;

    const intr = Cartesian3.add(
      this.projectionCenter,
      Cartesian3.multiplyByScalar(rayWorld, r, new Cartesian3()),
      new Cartesian3(),
    );
    return [intr.x, intr.y, avgHeight];
  }

  /**
   * @param {import("ol/coordinate").Coordinate} worldCoordinate
   * @param {number=} optAvgHeight
   * @returns {import("ol/coordinate").Coordinate}
   * @api
   */
  transformRealWorld2Image(worldCoordinate, optAvgHeight) {
    // if we dont have camera parameters
    if (!this.meta.principalPoint) {
      return this._transformNoCamera(worldCoordinate, false, optAvgHeight);
    }

    // usage of perspective projection
    // the averaged height is used for projection so far
    const avgHeight = optAvgHeight || this.averageHeight;

    const P = new Cartesian4(worldCoordinate[0], worldCoordinate[1], avgHeight, 1);

    const camSys = Matrix4.multiplyByVector(this.pToImage, P, new Cartesian4());
    const respectiveImageCoords = [camSys.x / camSys.z, camSys.y / camSys.z];
    // adjust to ol image coordinates
    const imCoords = [respectiveImageCoords[0], this.meta.size[1] - respectiveImageCoords[1]];

    return this.meta.radialDistortionCoordinate(imCoords, false);
  }


  /**
   * @param {import("ol/coordinate").Coordinate} coord
   * @param {boolean} isImage
   * @param {number=} optAvgHeight
   * @private
   * @returns {import("ol/coordinate").Coordinate}
   */
  _transformNoCamera(coord, isImage, optAvgHeight) {
    const imageCoords = [[0, 0], [this.meta.size[0], 0], this.meta.size, [0, this.meta.size[1]]];
    const intrCross = transformCWIFC(
      isImage ? imageCoords : this.groundCoordinates,
      isImage ? this.groundCoordinates : imageCoords,
      isImage,
      coord,
      this.viewDirection,
    );
    const height = optAvgHeight || this.averageHeight;
    // if intersection could not be determined write error and return center
    if (intrCross === null || intrCross.x == null || intrCross.y == null) {
      // eslint-disable-next-line no-console
      console.error('Real world coordinate could not be determined from footprint data, center will be returned');
      const coords = [this.centerPointOnGround[0], this.centerPointOnGround[1]];
      if (isImage) {
        coords.push(height);
      }
      return coords;
    }
    const coords = [intrCross.x, intrCross.y];
    if (isImage) {
      coords.push(height);
    }
    return coords;
  }

  /**
   * calculates the averageHeight of this image, if a terrainProvider is given the height will be requested
   * @returns {Promise<void>}
   * @api
   */
  calculateImageAverageHeight() {
    if (this._averageHeight === null) {
      const averageHeight = (
        this.groundCoordinates[0][2] +
        this.groundCoordinates[1][2] +
        this.groundCoordinates[2][2] +
        this.groundCoordinates[3][2]) / 4;
      if (averageHeight === 0 && this.meta.terrainProvider) {
        return getHeightFromTerrainProvider(
          this.meta.terrainProvider,
          [this.centerPointOnGround.slice()],
          this.meta.projection,
        )
          .then((coords) => {
            if (coords[0] && coords[0][2] != null) {
              this._averageHeight = coords[0][2];
            }
          })
          .catch(() => {
            this._averageHeight = averageHeight;
          });
      }
      this._averageHeight = averageHeight;
    }
    return Promise.resolve();
  }
}

export default ObliqueImage;
