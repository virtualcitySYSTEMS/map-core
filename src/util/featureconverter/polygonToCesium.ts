import {
  Cartesian3,
  PolygonGeometry,
  PerInstanceColorAppearance,
  PolygonOutlineGeometry,
  GroundPolylineGeometry,
  PolygonHierarchy,
  PolylineGeometry,
} from '@vcmap-cesium/engine';
import type { Style } from 'ol/style.js';
import type { Polygon } from 'ol/geom.js';
import { parseNumber } from '@vcsuite/parsers';
import type { VectorHeightInfo } from './vectorHeightInfo.js';
import { mercatorToCartesianTransformerForHeightInfo } from './vectorHeightInfo.js';
import type {
  CesiumGeometryOption,
  PolygonGeometryOptions,
  PolylineGeometryOptions,
  VectorGeometryFactory,
} from './vectorGeometryFactory.js';

function createPolygonGeometry(
  options: PolygonGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): PolygonGeometry {
  const polygonOptions: PolygonGeometryOptions = {
    ...options,
    perPositionHeight,
    extrudedHeight,
  };
  if (!perPositionHeight) {
    polygonOptions.height = height;
  }

  return new PolygonGeometry(polygonOptions);
}

function createSolidGeometries(
  options: PolygonGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'solid'>[] {
  return [
    {
      type: 'solid',
      geometry: createPolygonGeometry(
        options,
        height,
        perPositionHeight,
        extrudedHeight,
      ),
      heightInfo,
    },
  ];
}

function createOutlineGeometries(
  options: PolygonGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'outline'>[] {
  return [
    {
      type: 'outline',
      geometry: new PolygonOutlineGeometry({
        ...options,
        height: perPositionHeight ? undefined : height,
        extrudedHeight,
        perPositionHeight,
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
      heightInfo,
    },
  ];
}

function createFillGeometries(
  options: PolygonGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
): CesiumGeometryOption<'fill'>[] {
  return [
    {
      type: 'fill',
      geometry: createPolygonGeometry(options, height, perPositionHeight),
      heightInfo,
    },
  ];
}

function getLineGeometryOptions(
  options: PolygonGeometryOptions,
  style: Style,
): PolylineGeometryOptions[] {
  const width = parseNumber(style.getStroke()?.getWidth(), 1.0);
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
  return geometryOptions;
}

function createGroundLineGeometries(
  options: PolygonGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'groundLine'>[] {
  return getLineGeometryOptions(options, style).map((option) => ({
    type: 'groundLine',
    geometry: new GroundPolylineGeometry(option),
    heightInfo,
  }));
}

function createLineGeometries(
  options: PolygonGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'line'>[] {
  return getLineGeometryOptions(options, style).map((option) => ({
    type: 'line',
    geometry: new PolylineGeometry(option),
    heightInfo,
  }));
}

function getGeometryOptions(
  geometry: Polygon,
  heightInfo: VectorHeightInfo,
): PolygonGeometryOptions {
  let hieraryPositions;
  const holes = [];
  const rings = geometry.getLinearRings();

  const coordinateTransformer =
    mercatorToCartesianTransformerForHeightInfo(heightInfo);
  for (let i = 0; i < rings.length; i++) {
    const coords = rings[i].getCoordinates();
    const positions = coords.map(coordinateTransformer);
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

let geometryFactory: VectorGeometryFactory<'polygon'> | undefined;

export function getPolygonGeometryFactory(): VectorGeometryFactory<'polygon'> {
  if (!geometryFactory) {
    geometryFactory = {
      type: 'polygon',
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries,
      createGroundLineGeometries,
      createLineGeometries,
      validateGeometry: validatePolygon,
    };
  }
  return geometryFactory;
}
