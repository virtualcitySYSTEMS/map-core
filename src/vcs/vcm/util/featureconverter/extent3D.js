import GeometryType from 'ol/geom/GeometryType.js';
import { check } from '@vcsuite/check';


class Extent3D {
  /**
   * @param {Array<number>} array
   * @returns {Extent3D}
   */
  static fromArray(array) {
    check(array, [Number]);
    check(array.length, 6);
    return new Extent3D(array[0], array[1], array[2], array[3], array[4], array[5]);
  }

  /**
   * @param {import("ol/geom").Geometry} geometry
   * @returns {Extent3D}
   */
  static fromGeometry(geometry) {
    const extent = new Extent3D();
    extent.extendWithGeometry(geometry);
    return extent;
  }

  /**
   * @param {VectorHeightInfo} heightInfo
   * @returns {Extent3D}
   */
  static fromHeightInfo(heightInfo) {
    const extent = new Extent3D();
    extent.extendWithHeightInfo(heightInfo);
    return extent;
  }

  /**
   * @param {number} minX
   * @param {number} minY
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxY
   * @param {number} maxZ
   */
  constructor(minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity) {
    /**
     * @type {number}
     */
    this.minX = minX;
    /**
     * @type {number}
     */
    this.minY = minY;
    /**
     * @type {number}
     */
    this.minZ = minZ;
    /**
     * @type {number}
     */
    this.maxX = maxX;
    /**
     * @type {number}
     */
    this.maxY = maxY;
    /**
     * @type {number}
     */
    this.maxZ = maxZ;
  }

  /**
   * @param {import("ol/geom").Geometry} geometry
   */
  extendWithGeometry(geometry) {
    if (geometry.getType() === GeometryType.GEOMETRY_COLLECTION) {
      /** @type {import("ol/geom/GeometryCollection").default} */ (geometry)
        .getGeometriesArray().forEach((geom) => { this.extendWithGeometry(geom); });
    } else if (geometry.getType() === GeometryType.CIRCLE) {
      const flatCoordinates = /** @type {import("ol/geom/Circle").default} */ (geometry).getFlatCoordinates();
      const stride = /** @type {import("ol/geom/Circle").default} */ (geometry).getStride();
      const radius = flatCoordinates[stride] - flatCoordinates[0];
      this.extendXY(
        flatCoordinates[0] - radius,
        flatCoordinates[1] - radius,
      );
      this.extendXY(
        flatCoordinates[0] + radius,
        flatCoordinates[1] + radius,
      );
      if (stride > 2) {
        this.extendZ(flatCoordinates[2]);
      }
    } else {
      const flatCoordinates = /** @type {import("ol/geom/SimpleGeometry").default} */ (geometry).getFlatCoordinates();
      const stride = /** @type {import("ol/geom/SimpleGeometry").default} */ (geometry).getStride();
      this.extendFlatCoordinates(flatCoordinates, stride);
    }
  }

  /**
   * @param {VectorHeightInfo} heightInfo
   */
  extendWithHeightInfo(heightInfo) {
    if (heightInfo.extruded) {
      const calculatedFeatureMaxHeight =
        heightInfo.groundLevel + heightInfo.storeyHeightsAboveGround.reduce((accumulator, currentValue) => {
          return accumulator + currentValue;
        }, 0);
      this.extendZ(calculatedFeatureMaxHeight);
      const calculatedFeatureMinHeight =
        heightInfo.groundLevel - heightInfo.storeyHeightsBelowGround.reduce((accumulator, currentValue) => {
          return accumulator + currentValue;
        }, 0);
      this.extendZ(calculatedFeatureMinHeight);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  extendXYZ(x, y, z) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.minZ = Math.min(this.minZ, z);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.maxZ = Math.max(this.maxZ, z);
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  extendXY(x, y) {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  /**
   * @param {number} z
   */
  extendZ(z) {
    this.minZ = Math.min(this.minZ, z);
    this.maxZ = Math.max(this.maxZ, z);
  }

  /**
   * @param {Array<number>} flatCoordinates
   * @param {number} stride
   */
  extendFlatCoordinates(flatCoordinates, stride) {
    const { length } = flatCoordinates;
    for (let offset = 0; offset < length; offset += stride) {
      if (stride > 2) {
        this.extendXYZ(flatCoordinates[offset], flatCoordinates[offset + 1], flatCoordinates[offset + 2]);
      } else {
        this.extendXY(flatCoordinates[offset], flatCoordinates[offset + 1]);
      }
    }
  }

  /**
   * @returns {import("ol/extent").Extent}
   */
  to2D() {
    return [this.minX, this.minY, this.maxX, this.maxY];
  }

  /**
   * @returns {Array<number>}
   */
  toArray() {
    return [this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ];
  }
}

export default Extent3D;
