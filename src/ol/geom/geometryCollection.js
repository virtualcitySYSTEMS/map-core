import GeometryCollection from 'ol/geom/GeometryCollection.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import { check } from '@vcsuite/check';

/**
 * @returns {Array<import("ol/coordinate").Coordinate|Array<import("ol/coordinate").Coordinate>|Array<Array<import("ol/coordinate").Coordinate>>|Array<Array<Array<import("ol/coordinate").Coordinate>>>>}
 */
GeometryCollection.prototype.getCoordinates = function getCoordinates() {
  return this.getGeometries().map(g => g.getCoordinates());
};

/**
 * @param {Array<import("ol/coordinate").Coordinate|Array<import("ol/coordinate").Coordinate>|Array<Array<import("ol/coordinate").Coordinate>>|Array<Array<Array<import("ol/coordinate").Coordinate>>>>} coordinates
 * @param {import("ol/geom/GeometryLayout").default=} optLayout
 */
GeometryCollection.prototype.setCoordinates = function setCoordinates(coordinates, optLayout) {
  check(coordinates, Array);
  check(coordinates.length, this.getGeometries().length);

  this.setGeometries(this.getGeometries()
    .map((g, i) => { g.setCoordinates(coordinates[i], optLayout); return g; }));
};

/**
 * @returns {import("ol/geom/GeometryLayout").default}
 */
GeometryCollection.prototype.getLayout = function getLayout() {
  const firstGeom = this.getGeometries()[0];
  if (firstGeom) {
    return firstGeom.getLayout();
  }
  return /** @type {undefined} */ (GeometryLayout.XYZ);
};
