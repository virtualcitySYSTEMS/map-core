import Circle from 'ol/geom/Circle.js';
import { check } from '@vcs/check';
import { cartesian2DDistance, cartesian3DDistance } from '../../vcs/vcm/util/math.js';

/**
 * @returns {Array<ol/Coordinate>} returns an Array where the first coordinate is the center, and the second the center with an x offset of radius
 */
Circle.prototype.getCoordinates = function getCoordinates() {
  return [this.getCenter(), this.getLastCoordinate()];
};

/**
 * @param {Array<ol/Coordinate>} coordinates - array of length two. The first coordinate is treated as the center, the second as the center with an x offset of radius
 * @param {ol/geom/GeometryLayout=} optLayout
 */
Circle.prototype.setCoordinates = function setCoordinates(coordinates, optLayout) {
  check(coordinates, [[Number]]);
  check(coordinates.length, 2);

  const layout = optLayout || this.getLayout();
  const getRadius = /XYM?/.test(layout) ? cartesian2DDistance : cartesian3DDistance;
  this.setCenterAndRadius(coordinates[0], getRadius(...coordinates), optLayout);
};
