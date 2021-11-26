import GeometryType from 'ol/geom/GeometryType.js';

/**
 * Create an empty extent.
 * @returns {Array<number>} Empty extent.
 */
export function createEmpty3D() {
  return [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
}

/**
 * Create a new extent or update the provided extent.
 * @param {number} minX Minimum X.
 * @param {number} minY Minimum Y.
 * @param {number} minZ Minimum Z.
 * @param {number} maxX Maximum X.
 * @param {number} maxY Maximum Y.
 * @param {number} maxZ Maximum Z.
 * @param {Array<number>=} optExtent Destination extent.
 * @returns {Array<number>} Extent.
 */
export function createOrUpdate3D(minX, minY, minZ, maxX, maxY, maxZ, optExtent) {
  if (optExtent) {
    optExtent[0] = minX;
    optExtent[1] = minY;
    optExtent[2] = minZ;
    optExtent[3] = maxX;
    optExtent[4] = maxY;
    optExtent[5] = maxZ;
    return optExtent;
  } else {
    return [minX, minY, minZ, maxX, maxY, maxZ];
  }
}

/**
 * @param {Array<number>} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 * @param {number} z Z.
 */
export function extendXYZ(extent, x, y, z) {
  extent[0] = Math.min(extent[0], x);
  extent[1] = Math.min(extent[1], y);
  extent[2] = Math.min(extent[2], z);
  extent[3] = Math.max(extent[3], x);
  extent[4] = Math.max(extent[4], y);
  extent[5] = Math.max(extent[5], z);
}
/**
 * @param {Array<number>} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 */
export function extendXY(extent, x, y) {
  extent[0] = Math.min(extent[0], x);
  extent[1] = Math.min(extent[1], y);
  extent[3] = Math.max(extent[3], x);
  extent[4] = Math.max(extent[4], y);
}

/**
 * @param {Array<number>} extent Extent.
 * @param {number} z Z.
 */
export function extendZ(extent, z) {
  extent[2] = Math.min(extent[2], z);
  extent[5] = Math.max(extent[5], z);
}

/**
 * @param {Array<number>} extent Extent.
 * @param {Array<number>} flatCoordinates Flat coordinates.
 * @param {number} stride Stride.
 * @returns {Array<number>} Extent.
 */
export function extendFlatCoordinates(
  extent,
  flatCoordinates,
  stride,
) {
  const { length } = flatCoordinates;
  for (let offset = 0; offset < length; offset += stride) {
    if (stride > 2) {
      extendXYZ(extent, flatCoordinates[offset], flatCoordinates[offset + 1], flatCoordinates[offset + 2]);
    } else {
      extendXY(extent, flatCoordinates[offset], flatCoordinates[offset + 1]);
    }
  }
  return extent;
}

/**
 * @param {import("ol/geom/Geometry").default} geometry Geometry.
 * @param {Array<number>=} optExtent Extent.
 * @returns {Array<number>} Extent.
 */
export function createOrUpdateFromGeometry(geometry, optExtent) {
  const extent = optExtent || createEmpty3D();
  if (geometry.getType() === GeometryType.GEOMETRY_COLLECTION) {
    /** @type {import("ol/geom/GeometryCollection").default} */ (geometry)
      .getGeometriesArray().forEach((geom) => { createOrUpdateFromGeometry(geom, extent); });
  } else if (geometry.getType() === GeometryType.CIRCLE) {
    const flatCoordinates = /** @type {import("ol/geom/Circle").default} */ (geometry).getFlatCoordinates();
    const stride = /** @type {import("ol/geom/Circle").default} */ (geometry).getStride();
    const radius = flatCoordinates[stride] - flatCoordinates[0];
    extendXY(
      extent,
      flatCoordinates[0] - radius,
      flatCoordinates[1] - radius,
    );
    extendXY(
      extent,
      flatCoordinates[0] + radius,
      flatCoordinates[1] + radius,
    );
    if (stride > 2) {
      extendZ(extent, flatCoordinates[2]);
    }
  } else {
    const flatCoordinates = /** @type {import("ol/geom/SimpleGeometry").default} */ (geometry).getFlatCoordinates();
    const stride = /** @type {import("ol/geom/SimpleGeometry").default} */ (geometry).getStride();
    extendFlatCoordinates(extent, flatCoordinates, stride);
  }
  return extent;
}

/**
 * @param {VectorHeightInfo} heightInfo
 * @param {Array<number>} optExtent
 */
export function createOrUpdateFromHeightInfo(heightInfo, optExtent) {
  const extent = optExtent || createEmpty3D();
  if (heightInfo.extruded) {
    const calculatedFeatureMaxHeight =
      heightInfo.groundLevel + heightInfo.storeyHeightsAboveGround.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      }, 0);
    extendZ(extent, calculatedFeatureMaxHeight);
    const calculatedFeatureMinHeight =
      heightInfo.groundLevel - heightInfo.storeyHeightsBelowGround.reduce((accumulator, currentValue) => {
        return accumulator + currentValue;
      }, 0);
    extendZ(extent, calculatedFeatureMinHeight);
  }
}

/**
 * @param {Array<number>} extent Extent.
 * @returns {import("ol/extent").Extent} Extent.
 */
export function make2D(extent) {
  return [extent[0], extent[1], extent[3], extent[4]];
}
