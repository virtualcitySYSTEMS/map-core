import {
  ArcType,
  Cartesian3,
  HeightReference,
  Scene,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { LineString } from 'ol/geom.js';
import type { Feature } from 'ol/index.js';

import Projection from '../projection.js';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import {
  createFillGeometries,
  createGroundLineGeometries,
  createLineGeometries,
  createOutlineGeometries,
  createSolidGeometries,
  validateLineString,
  getCoordinates as getLineStringCoordinates,
  getGeometryOptions as getLineStringGeometryOptions,
  addArrowsToContext,
} from './lineStringToCesium.js';
import ArcStyle, { featureArcStruct } from '../../style/arcStyle.js';
import { VectorGeometryFactoryType } from '../../layer/vectorLayer.js';
import VectorProperties from '../../layer/vectorProperties.js';
import type { AsyncCesiumVectorContext } from '../../layer/cesium/vectorContext.js';

/**
 * Creates the positions & arcType option for the PolylineGeometry
 */
export function getGeometryOptions(
  coords: Coordinate[],
  _geometry: LineString,
  positionHeightAdjustment: number,
  perPositionHeight: boolean,
  groundLevelOrMinHeight: number,
): { positions: Cartesian3[]; arcType: ArcType } {
  const positions = coords.map((coord) => {
    const wgs84Coords = Projection.mercatorToWgs84(coord);
    if (!perPositionHeight && groundLevelOrMinHeight) {
      wgs84Coords[2] = groundLevelOrMinHeight;
    } else if (wgs84Coords[2] != null) {
      wgs84Coords[2] += positionHeightAdjustment;
    }
    return Cartesian3.fromDegrees(
      wgs84Coords[0],
      wgs84Coords[1],
      wgs84Coords[2],
    );
  });
  return { positions, arcType: ArcType.NONE };
}

/**
 * In this special case, the coordinates are not taken from the geometries array
 */
// eslint-disable-next-line no-unused-vars
export function getCoordinates(
  coords: Coordinate[],
  _geometries: LineString[],
): Coordinate[] {
  return coords;
}

/**
 * @param  arcCoords - the coordinates of the arc to use instead of the geometries coordinates if height mode is absolute
 */
function getGeometryFactory(
  arcCoords: Coordinate[],
  altitudeMode: HeightReference,
): VectorGeometryFactoryType {
  return {
    getCoordinates:
      altitudeMode === HeightReference.NONE
        ? getCoordinates.bind(null, arcCoords)
        : getLineStringCoordinates,
    getGeometryOptions:
      altitudeMode === HeightReference.NONE
        ? getGeometryOptions.bind(null, arcCoords)
        : getLineStringGeometryOptions,
    createSolidGeometries,
    createOutlineGeometries,
    createFillGeometries,
    createGroundLineGeometries,
    createLineGeometries,
  };
}

/**
 * converts a linestring with an ArcStyle to a a cesium primitive
 */
export default async function arcToCesium(
  feature: Feature,
  style: ArcStyle,
  geometries: LineString[],
  vectorProperties: VectorProperties,
  scene: Scene,
  context: AsyncCesiumVectorContext,
): Promise<void> {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const altitudeMode = vectorProperties.getAltitudeMode(feature);
  const arcGeometryFactory = getGeometryFactory(
    feature[featureArcStruct]!.coordinates!,
    altitudeMode,
  );
  const validGeometries = geometries.filter((lineString) =>
    validateLineString(lineString),
  );
  addPrimitivesToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    arcGeometryFactory,
    context,
  );
  await addArrowsToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    arcGeometryFactory,
    context,
  ); // IDEA what about labels?
}
