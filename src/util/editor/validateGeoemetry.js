import GeometryType from 'ol/geom/GeometryType.js';
import { validateLineString } from '../featureconverter/lineStringToCesium.js';
import { validatePolygon } from '../featureconverter/polygonToCesium.js';
import { validatePoint } from '../featureconverter/pointToCesium.js';
import { validateCircle } from '../featureconverter/circleToCesium.js';

/**
 * @param {import("ol/geom").Geometry} geometry
 * @returns {boolean}
 */
export default function geometryIsValid(geometry) {
  const type = geometry.getType();
  if (type === GeometryType.LINE_STRING) {
    return validateLineString(/** @type {import("ol/geom").LineString} */ (geometry));
  } else if (type === GeometryType.POLYGON) {
    return validatePolygon(/** @type {import("ol/geom").Polygon} */ (geometry));
  } else if (type === GeometryType.POINT) {
    return validatePoint(/** @type {import("ol/geom").Point} */ (geometry));
  } else if (type === GeometryType.CIRCLE) {
    return validateCircle(/** @type {import("ol/geom").Circle} */ (geometry));
  }
  return false;
}
