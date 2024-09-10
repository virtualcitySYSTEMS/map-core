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
 * @returns {import("ol/geom/Geometry").GeometryLayout}
 */
GeometryCollection.prototype.getLayout = function getLayout() {
  const firstGeom = this.getGeometriesArray()[0];
  if (firstGeom) {
    return firstGeom.getLayout();
  }
  return 'XYZ';
};

/**
 * @returns {number}
 */
GeometryCollection.prototype.getStride = function getStride() {
  const firstGeom = this.getGeometriesArray()[0];
  if (firstGeom) {
    return firstGeom.getStride();
  }
  return 2;
};

/**
 * @returns {number[]}
 */
GeometryCollection.prototype.getFlatCoordinates =
  function getFlatCoordinates() {
    return this.getGeometriesArrayRecursive().flatMap((g) =>
      g.getFlatCoordinates(),
    );
  };
