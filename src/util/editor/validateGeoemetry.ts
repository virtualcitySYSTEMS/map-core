import type { Geometry, LineString, Polygon, Point, Circle } from 'ol/geom.js';
import { validateLineString } from '../featureconverter/lineStringToCesium.js';
import { validatePolygon } from '../featureconverter/polygonToCesium.js';
import { validatePoint } from '../featureconverter/pointToCesium.js';
import { validateCircle } from '../featureconverter/circleToCesium.js';

export default function geometryIsValid(geometry?: Geometry): boolean {
  if (!geometry) {
    return false;
  }
  const type = geometry.getType();
  if (type === 'LineString') {
    return validateLineString(geometry as LineString);
  } else if (type === 'Polygon') {
    return validatePolygon(geometry as Polygon);
  } else if (type === 'Point') {
    return validatePoint(geometry as Point);
  } else if (type === 'Circle') {
    return validateCircle(geometry as Circle);
  }
  return false;
}
