import { ArcType, HeightReference } from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { LineString } from 'ol/geom.js';

import {
  createGroundLineGeometries,
  createLineGeometries,
  createOutlineGeometries,
  createSolidGeometries,
  validateLineString,
  getGeometryOptions as getLineStringGeometryOptions,
} from './lineStringToCesium.js';
import {
  mercatorToCartesianTransformerForHeightInfo,
  VectorHeightInfo,
} from './vectorHeightInfo.js';
import {
  PolylineGeometryOptions,
  VectorGeometryFactory,
} from './vectorGeometryFactory.js';

/**
 * Creates the positions & arcType option for the PolylineGeometry
 */
function getGeometryOptions(
  coords: Coordinate[],
  _geometry: LineString,
  heightInfo: VectorHeightInfo,
): PolylineGeometryOptions {
  const coordinateTransformer =
    mercatorToCartesianTransformerForHeightInfo(heightInfo);
  const positions = coords.map(coordinateTransformer);
  return { positions, arcType: ArcType.NONE };
}

/**
 * @param arcCoords - the coordinates of the arc to use instead of the geometries coordinates if height mode is absolute
 * @param altitudeMode
 */
// eslint-disable-next-line import/prefer-default-export
export function getArcGeometryFactory(
  arcCoords: Coordinate[],
  altitudeMode: HeightReference,
): VectorGeometryFactory<'arc'> {
  return {
    type: 'arc',
    getGeometryOptions:
      altitudeMode === HeightReference.NONE
        ? getGeometryOptions.bind(null, arcCoords)
        : getLineStringGeometryOptions,
    createSolidGeometries,
    createOutlineGeometries,
    createFillGeometries(): never[] {
      return [];
    },
    createGroundLineGeometries,
    createLineGeometries,
    validateGeometry: validateLineString,
  };
}
