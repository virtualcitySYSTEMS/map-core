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
import type { VectorHeightInfo } from './vectorHeightInfo.js';
import { mercatorToCartesianTransformerForHeightInfo } from './vectorHeightInfo.js';
import type {
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
