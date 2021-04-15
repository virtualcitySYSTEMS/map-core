import GeometryCollection from 'ol/geom/GeometryCollection.js';
import { check } from '@vcs/check';

/**
 * @returns {Array<ol/Coordinate|Array<ol/Coordinate>|Array<Array<ol/Coordinate>>|Array<Array<Array<ol/Coordinate>>>>}
 */
GeometryCollection.prototype.getCoordinates = function getCoordinates() {
  return this.getGeometries().map(g => g.getCoordinates());
};

/**
 * @param {Array<ol.Coordinate|Array<ol.Coordinate>|Array<Array<ol.Coordinate>>|Array<Array<Array<ol.Coordinate>>>>} coordinates
 * @param {ol/geom/GeometryLayout=} optLayout
 */
GeometryCollection.prototype.setCoordinates = function setCoordinates(coordinates, optLayout) {
  check(coordinates, Array);
  check(coordinates.length, this.getGeometries().length);

  this.setGeometries(this.getGeometries()
    .map((g, i) => { g.setCoordinates(coordinates[i], optLayout); return g; }));
};

/**
 * @returns {ol/geom/GeometryLayout}
 */
GeometryCollection.prototype.getLayout = function getLayout() {
  const firstGeom = this.getGeometries()[0];
  if (firstGeom) {
    return firstGeom.getLayout();
  }
  return 'XYZ';
};
