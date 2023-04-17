import { ArcType, Cartesian3, HeightReference } from '@vcmap-cesium/engine';
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
import { featureArcStruct } from '../../style/arcStyle.js';

/**
 * Creates the positions & arcType option for the PolylineGeometry
 * @param {Array<import("ol/coordinate").Coordinate>} coords
 * @param {import("ol/geom/LineString").default} geometry
 * @param {number} positionHeightAdjustment
 * @returns {Object}
 * @private
 */
export function getGeometryOptions(coords, geometry, positionHeightAdjustment) {
  const positions = coords.map((coord) => {
    const wgs84Coords = Projection.mercatorToWgs84(coord);
    if (wgs84Coords[2] != null) {
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
 * @param {Array<import("ol/coordinate").Coordinate>} coords
 * @param {Array<import("ol/geom/LineString").default>} geometries
 * @returns {Array<import("ol/coordinate").Coordinate>}
 * @private
 */
// eslint-disable-next-line no-unused-vars
export function getCoordinates(coords, geometries) {
  return coords;
}

/**
 * @param {Array<import("ol/coordinate").Coordinate>} arcCoords - the coordinates of the arc to use instead of the geometries coordinates if height mode is absolute
 * @param {import("@vcmap-cesium/engine").HeightReference} altitudeMode
 * @returns {VectorGeometryFactoryType}
 */
function getGeometryFactory(arcCoords, altitudeMode) {
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
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("@vcmap/core").ArcStyle} style
 * @param {Array<import("ol/geom/LineString").default>} geometries
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap-cesium/engine").Scene} scene
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
export default function arcToCesium(
  feature,
  style,
  geometries,
  vectorProperties,
  scene,
  context,
) {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const altitudeMode = vectorProperties.getAltitudeMode(feature);
  const arcGeometryFactory = getGeometryFactory(
    feature[featureArcStruct].coordinates,
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
  addArrowsToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    arcGeometryFactory,
    context,
  ); // IDEA what about labels?
}
