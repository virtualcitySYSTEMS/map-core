import GeometryCollection from 'ol/geom/GeometryCollection.js';
import { check } from '@vcsuite/check';

/**
 * @returns {Array<import("ol/coordinate").Coordinate|Array<import("ol/coordinate").Coordinate>|Array<Array<import("ol/coordinate").Coordinate>>|Array<Array<Array<import("ol/coordinate").Coordinate>>>>}
 */
GeometryCollection.prototype.getCoordinates = function getCoordinates() {
  return this.getGeometriesArray().map((g) => g.getCoordinates());
};

/**
 * @param {Array<import("ol/coordinate").Coordinate|Array<import("ol/coordinate").Coordinate>|Array<Array<import("ol/coordinate").Coordinate>>|Array<Array<Array<import("ol/coordinate").Coordinate>>>>} coordinates
 * @param {import("ol/geom/Geometry").GeometryLayout=} optLayout
 */
GeometryCollection.prototype.setCoordinates = function setCoordinates(
  coordinates,
  optLayout,
) {
  check(coordinates, Array);
  check(coordinates.length, this.getGeometries().length);

  this.setGeometries(
    this.getGeometries().map((g, i) => {
      g.setCoordinates(coordinates[i], optLayout);
      return g;
    }),
  );
};

/**
 * @type {Record<import("ol/geom/Geometry").GeometryLayout, number>}
 */
const layoutScore = {
  XY: 1,
  XYM: 2,
  XYZ: 3,
  XYZM: 4,
};

/**
 * @type {Record<import("ol/geom/Geometry").GeometryLayout, number>}
 */
const layoutStride = {
  XY: 2,
  XYM: 3,
  XYZ: 3,
  XYZM: 4,
};

/**
 * @param {import("ol/geom/Geometry").GeometryLayout} layout
 * @param {import("ol/geom/Geometry").GeometryLayout=} minLayout
 * @returns { import("ol/geom/Geometry").GeometryLayout}
 */
function getMinLayout(layout, minLayout) {
  if (!minLayout) {
    return layout;
  }
  if (
    (minLayout === 'XYM' && layout !== 'XYM') ||
    (layout === 'XYM' && minLayout !== 'XYM')
  ) {
    return 'XY';
  }
  const inScore = layoutScore[layout];
  const minScore = layoutScore[minLayout];
  if (inScore < minScore) {
    return layout;
  }

  return minLayout;
}

/**
 * @returns {import("ol/geom/Geometry").GeometryLayout}
 */
GeometryCollection.prototype.getLayout = function getLayout() {
  let maxCommonLayout;
  this.getGeometriesArrayRecursive().forEach((geom) => {
    maxCommonLayout = getMinLayout(geom.getLayout(), maxCommonLayout);
  });

  return maxCommonLayout ?? 'XY';
};

/**
 * @returns {number}
 */
GeometryCollection.prototype.getStride = function getStride() {
  const layout = this.getLayout();
  return layoutStride[layout];
};

/**
 * @returns {number[]}
 */
GeometryCollection.prototype.getFlatCoordinates =
  function getFlatCoordinates() {
    const commonStride = this.getStride();
    const flatCoordinates = [];
    this.getGeometriesArrayRecursive().forEach((geom) => {
      const geometryStride = geom.getStride();
      const geometryFlatCoordinates = geom.getFlatCoordinates();
      if (geometryStride === commonStride) {
        flatCoordinates.push(geometryFlatCoordinates);
      } else if (geometryStride > commonStride) {
        const geometryCoordinateLength = geometryFlatCoordinates.length;
        const numberOfCoordinates = Math.round(
          geometryCoordinateLength / geometryStride,
        );
        const slicedGeometryCoordinates = new Array(
          numberOfCoordinates * commonStride,
        );
        for (let i = 0; i < geometryCoordinateLength; i += geometryStride) {
          for (let j = 0; j < commonStride; j++) {
            const slicedGeometryCoordinateOffset = Math.round(
              (i / geometryStride) * commonStride,
            );

            slicedGeometryCoordinates[slicedGeometryCoordinateOffset + j] =
              geometryFlatCoordinates[i + j];
          }
        }
        flatCoordinates.push(slicedGeometryCoordinates);
      }
    });

    return [].concat(...flatCoordinates);
  };
