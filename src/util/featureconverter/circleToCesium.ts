import { circular } from 'ol/geom/Polygon.js';
import type { Style } from 'ol/style.js';
import type { Circle } from 'ol/geom.js';
import {
  Cartesian3,
  CircleGeometry,
  GroundPolylineGeometry,
  CircleOutlineGeometry,
  Math as CesiumMath,
  Cartographic,
  PolylineGeometry,
} from '@vcmap-cesium/engine';
import { parseNumber } from '@vcsuite/parsers';
import type { VectorHeightInfo } from './vectorHeightInfo.js';
import { mercatorToCartesianTransformerForHeightInfo } from './vectorHeightInfo.js';
import type {
  CesiumGeometryOption,
  CircleGeometryOptions,
  VectorGeometryFactory,
} from './vectorGeometryFactory.js';

function createCircleGeometry(
  options: CircleGeometryOptions,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CircleGeometry {
  const geometryOptions = {
    ...options,
    granularity: 0.02,
    extrudedHeight,
  };

  if (!perPositionHeight) {
    geometryOptions.height = height;
  } else {
    const cartographic = Cartographic.fromCartesian(options.center);
    geometryOptions.height = cartographic.height;
  }

  return new CircleGeometry(geometryOptions);
}

function createSolidGeometries(
  options: CircleGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'solid'>[] {
  return [
    {
      type: 'solid',
      geometry: createCircleGeometry(
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
  options: CircleGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
  extrudedHeight?: number,
): CesiumGeometryOption<'outline'>[] {
  const geometryOptions = {
    ...options,
    granularity: 0.02,
    extrudedHeight,
  };

  if (!perPositionHeight) {
    geometryOptions.height = height;
  } else {
    const cartographic = Cartographic.fromCartesian(options.center);
    geometryOptions.height = cartographic.height;
  }
  return [
    {
      type: 'outline',
      geometry: new CircleOutlineGeometry(geometryOptions),
      heightInfo,
    },
  ];
}

function createFillGeometries(
  options: CircleGeometryOptions,
  heightInfo: VectorHeightInfo,
  height: number,
  perPositionHeight: boolean,
): CesiumGeometryOption<'fill'>[] {
  return [
    {
      type: 'fill',
      geometry: createCircleGeometry(options, height, perPositionHeight),
      heightInfo,
    },
  ];
}

function getLineGeometryOptions(
  options: CircleGeometryOptions,
  style: Style,
): { width: number; positions: Cartesian3[] } {
  const width = parseNumber(style.getStroke()?.getWidth(), 1.0);
  const { center, radius } = options;
  const cartographic = Cartographic.fromCartesian(center);
  const wgs84Center = [
    CesiumMath.toDegrees(cartographic.longitude),
    CesiumMath.toDegrees(cartographic.latitude),
  ];

  // circular returns polygon with GeometryLayout.XY
  const circlePolygon = circular(wgs84Center, radius, 40);
  const pos = circlePolygon.getLinearRing(0)!.getCoordinates();
  const positions = pos.map((coord) => {
    return Cartesian3.fromDegrees(coord[0], coord[1], cartographic.height);
  });
  return {
    positions,
    width,
  };
}

function createGroundLineGeometries(
  options: CircleGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'groundLine'>[] {
  const lineOptions = getLineGeometryOptions(options, style);
  return [
    {
      type: 'groundLine',
      geometry: new GroundPolylineGeometry(lineOptions),
      heightInfo,
    },
  ];
}

function createLineGeometries(
  options: CircleGeometryOptions,
  heightInfo: VectorHeightInfo,
  style: Style,
): CesiumGeometryOption<'line'>[] {
  const lineOptions = getLineGeometryOptions(options, style);
  return [
    {
      type: 'line',
      geometry: new PolylineGeometry(lineOptions),
      heightInfo,
    },
  ];
}

/**
 * extracts the center and radius from the CircleGeometry and converts it to Cartesian3/radius in m
 * @param  geometry
 * @param heightInfo
 * @returns
 * @private
 */
function getGeometryOptions(
  geometry: Circle,
  heightInfo: VectorHeightInfo,
): CircleGeometryOptions {
  // olCoordinates of center and radius in WGS84
  const olCenter = geometry.getCenter();
  const olPoint = olCenter.slice();
  olPoint[0] += geometry.getRadius();

  const coordinateTransformer =
    mercatorToCartesianTransformerForHeightInfo(heightInfo);

  // Cesium coordinates of center and radius
  const center = coordinateTransformer(olCenter);
  const point = coordinateTransformer(olPoint);

  // Computation of radius in Cesium 3D
  const radius = Cartesian3.distance(center, point);
  return {
    radius,
    center,
  };
}

/**
 * validates if a point is renderable
 */
export function validateCircle(circle: Circle): boolean {
  if (circle.getType() !== 'Circle') {
    return false;
  }
  const flatCoordinates = circle.getFlatCoordinates();
  const stride = circle.getStride();
  // needs at least one full coordinate + a radius value and a non 0 radius
  if (
    flatCoordinates &&
    flatCoordinates.length >= stride + 1 &&
    flatCoordinates[stride] !== flatCoordinates[0]
  ) {
    return flatCoordinates.every((value) => Number.isFinite(value));
  }
  return false;
}

let geometryFactory: VectorGeometryFactory<'circle'> | undefined;

export function getCircleGeometryFactory(): VectorGeometryFactory<'circle'> {
  if (!geometryFactory) {
    geometryFactory = {
      type: 'circle',
      getGeometryOptions,
      createSolidGeometries,
      createOutlineGeometries,
      createFillGeometries,
      createGroundLineGeometries,
      createLineGeometries,
      validateGeometry: validateCircle,
    };
  }
  return geometryFactory;
}
