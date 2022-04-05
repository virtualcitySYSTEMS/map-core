import Circle from 'ol/geom/Circle.js';
import { check } from '@vcsuite/check';
import { cartesian2DDistance, cartesian3DDistance } from '../../util/math.js';

/**
 * @returns {Array<import("ol/coordinate").Coordinate>} returns an Array where the first coordinate is the center, and the second the center with an x offset of radius
 */
// @ts-ignore
Circle.prototype.getCoordinates = function getCoordinates() {
  return [this.getCenter(), this.getLastCoordinate()];
};

/**
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates - array of length two. The first coordinate is treated as the center, the second as the center with an x offset of radius
 * @param {import("ol/geom/GeometryLayout").default=} optLayout
 */
Circle.prototype.setCoordinates = function setCoordinates(coordinates, optLayout) {
  check(coordinates, [[Number]]);
  check(coordinates.length, 2);

  const layout = optLayout || this.getLayout();
  const getRadius = /XYM?/.test(layout) ? cartesian2DDistance : cartesian3DDistance;
  this.setCenterAndRadius(coordinates[0], getRadius(coordinates[0], coordinates[1]), optLayout);
};
