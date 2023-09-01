import {
  Cartesian3,
  PolygonGeometry,
  PerInstanceColorAppearance,
  PolygonOutlineGeometry,
  GroundPolylineGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  type Scene,
  Cartographic,
} from '@vcmap-cesium/engine';
import type { Style } from 'ol/style.js';
import type { Polygon } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';
import { parseNumber } from '@vcsuite/parsers';
import { addPrimitivesToContext } from './featureconverterHelper.js';
import Projection from '../projection.js';
import { getFlatCoordinatesFromSimpleGeometry } from '../geometryHelpers.js';
import type { VectorGeometryFactoryType } from '../../layer/vectorLayer.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import { CesiumVectorContext } from '../../layer/cesium/vectorContext.js';

export type PolygonGeometryOptions = ConstructorParameters<
  typeof PolygonGeometry
>[0];

export type PolylineGeometryOptions = ConstructorParameters<
  typeof PolylineGeometry
>[0];

export function createSolidGeometries(
  options: PolygonGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): PolygonGeometry[] {
  const polygonOptions: PolygonGeometryOptions = {
    ...options,
    perPositionHeight,
    extrudedHeight,
  };
  if (!perPositionHeight) {
    polygonOptions.height = height;
  }
  return [new PolygonGeometry(polygonOptions)];
}

export function createOutlineGeometries(
  options: PolygonGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): PolygonOutlineGeometry[] {
  return [
    new PolygonOutlineGeometry({
      ...options,
      height: perPositionHeight ? undefined : height,
      extrudedHeight,
      perPositionHeight,
      vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
    }),
  ];
}

export function createFillGeometries(
  options: PolygonGeometryOptions,
  height: number,
  perPositionHeight: boolean,
): PolygonGeometry[] {
  return createSolidGeometries(options, height, perPositionHeight, undefined);
}

export function getLineGeometryOptions(
  options: PolygonGeometryOptions,
  style: Style,
  groundLevel?: number,
): PolylineGeometryOptions[] {
  const width = parseNumber(style.getStroke().getWidth(), 1.0);
  const geometryOptions: PolylineGeometryOptions[] = [];

  geometryOptions.push({
    positions: options.polygonHierarchy.positions,
    width,
  });

  options.polygonHierarchy.holes.forEach((polygonHierarchy) => {
    geometryOptions.push({
      positions: polygonHierarchy.positions,
      width,
    });
  });

  if (groundLevel) {
    geometryOptions.forEach((polylineOptions) => {
      polylineOptions.positions = polylineOptions.positions.map((c) => {
        const geographic = Cartographic.fromCartesian(c);
        geographic.height = groundLevel;
        return Cartographic.toCartesian(geographic);
      });
    });
  }
  return geometryOptions;
}

export function createGroundLineGeometries(
  options: PolygonGeometryOptions,
  style: Style,
): GroundPolylineGeometry[] {
  return getLineGeometryOptions(options, style).map((option) => {
    return new GroundPolylineGeometry(option);
  });
}
export function createLineGeometries(
  options: PolygonGeometryOptions,
  style: Style,
  groundLevel?: number,
): PolylineGeometry[] {
  return getLineGeometryOptions(options, style, groundLevel).map((option) => {
    return new PolylineGeometry(option);
  });
}

export function getGeometryOptions(
  geometry: Polygon,
  positionHeightAdjustment: number,
): PolygonGeometryOptions {
  let hieraryPositions;
  const holes = [];
  const rings = geometry.getLinearRings();
  for (let i = 0; i < rings.length; i++) {
    const coords = rings[i].getCoordinates();
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
    // make sure the last and first vertex is identical.
    if (!Cartesian3.equals(positions[0], positions[positions.length - 1])) {
      positions.push(positions[0]);
    }
    if (i === 0) {
      hieraryPositions = positions;
    } else {
      holes.push(new PolygonHierarchy(positions));
    }
  }
  return {
    polygonHierarchy: new PolygonHierarchy(hieraryPositions, holes),
  };
}

export function getCoordinates(geometries: Polygon[]): Coordinate[] {
  const coordinates: Coordinate[] = [];
  geometries.forEach((polygon) => {
    coordinates.push(...getFlatCoordinatesFromSimpleGeometry(polygon));
  });
  return coordinates;
}

let geometryFactory: VectorGeometryFactoryType | null = null;

function getGeometryFactory(): VectorGeometryFactoryType {
  if (!geometryFactory) {
    geometryFactory = {
      getCoordinates,
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries,
      createGroundLineGeometries,
      createLineGeometries,
    };
  }
  return geometryFactory;
}

/**
 * TODO maybe add validation Functions to OpenlayersMap
 * validates if a polygon is renderable
 * @param  polygon
 */
export function validatePolygon(polygon: Polygon): boolean {
  if (polygon.getType() !== 'Polygon') {
    return false;
  }
  const flatCoordinates = polygon.getFlatCoordinates();
  const ends = polygon.getEnds();
  const stride = polygon.getStride();
  const valid = ends.every((end, index) => {
    const previous = index ? ends[index - 1] : 0;
    const currentRingSize = end - previous;
    return currentRingSize >= stride * 3;
  });
  if (!valid) {
    return false;
  }
  // should have at least three coordinates for each linearRing and every value should be a number
  const minimumValues = stride * 3 * polygon.getLinearRingCount();
  if (
    flatCoordinates &&
    flatCoordinates.length >= minimumValues &&
    polygon.getLinearRingCount()
  ) {
    return flatCoordinates.every((value) => Number.isFinite(value));
  }
  return false;
}

/**
 * converts a polygon to a a cesium primitive, with optional labels
 * @param  feature
 * @param  style
 * @param  geometries
 * @param  vectorProperties
 * @param  scene
 * @param  context
 */
export default function polygonToCesium(
  feature: Feature,
  style: Style,
  geometries: Polygon[],
  vectorProperties: VectorProperties,
  scene: Scene,
  context: CesiumVectorContext,
): void {
  if (!style.getFill() && !style.getStroke()) {
    return;
  }
  const polygonGeometryFactory = getGeometryFactory();
  const validGeometries = geometries.filter((polygon) =>
    validatePolygon(polygon),
  );
  addPrimitivesToContext(
    feature,
    style,
    validGeometries,
    vectorProperties,
    scene,
    polygonGeometryFactory,
    context,
  );
}
