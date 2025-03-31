import type { Coordinate } from 'ol/coordinate.js';
import { Fill, Icon, Stroke, Style } from 'ol/style.js';
import { Feature } from 'ol';
import type { Geometry } from 'ol/geom.js';
import { Point } from 'ol/geom.js';
import RegularShape from 'ol/style/RegularShape.js';
import {
  Cartesian2,
  Matrix2,
  Math as CesiumMath,
  HeightReference,
} from '@vcmap-cesium/engine';
import {
  cartesian2DDistanceSquared,
  cartesian2Intersection,
  cartesian3DDistanceSquared,
  getCartesianBearing,
  getMidPoint,
} from '../math.js';
import { getClosestPointOn2DLine } from './editorHelpers.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
  doNotTransform,
} from '../../layer/vectorSymbols.js';
import { blackColor } from '../../style/styleHelpers.js';
import { PrimitiveOptionsType } from '../../layer/vectorProperties.js';
import {
  isClampedHeightReference,
  isRelativeHeightReference,
} from '../featureconverter/vectorHeightInfo.js';

export const snapTypes = ['orthogonal', 'parallel', 'vertex', 'edge'] as const;

export type SnapType = (typeof snapTypes)[number];

export type SnapResult<T extends SnapType = SnapType> = T extends 'orthogonal'
  ? {
      type: T;
      snapped: Coordinate;
      otherVertexIndex: number;
    }
  : T extends 'parallel'
    ? {
        type: T;
        parallelIndex: number;
        snapped: Coordinate;
        otherVertexIndex: number;
      }
    : T extends 'vertex'
      ? {
          type: T;
          snapped: Coordinate;
        }
      : T extends 'edge'
        ? {
            type: T;
            snapped: Coordinate;
          }
        : never;

let scratchCartesian21 = new Cartesian2();
let scratchCartesian22 = new Cartesian2();

const orothogonalSrc =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABkCAYAAAA2VDb+AAACmElEQVR4Xu2a3zHFQBjFz60AFeDNGypABcaTVzqgAlSADuiACuiADtCBDpgzk525Yyb5cpNNzibOvt652f1+3/n+bbIA8IP6tWj4bRY/0UADsAIcArUEnANmkemCGHcSdBJ0EnQSrCPgKuAqMHMCngU8DHka9DjsVtitsFtht8JuhWsIeBaYeScMt8Juhd0KuxV2K+xWuJ7ANoDPOZfCqAzSdgJ4AvAK4HluMNoA+GszYdxXQCbPowuAZDRBXE49RPoASCAeANxMFUQOAAnEXaWISYVFTgA0nInyBMD3VCjkBpCqBiG8TwHCEACS3ecAmB+KXhGAfQCHAM4A7HawhOXyosP/RvtLBGD5RoggrgEcrHi6opWwCoBkdxcQxULoAiCBoLRvW6qBVeGoxMTYBwBtpxrYEa61AFEkhL4AaPdWBaFNkuRgxQmzmJUDAI1Zr5qgNhDYNjOZFrFyAVgFAkOB5bWIe4acAFI4sAOMcgLzBrtF+coNgAbtVeEQQWBV4OwgXUMAoEGM8avAsiIS4lAAaDsN3AwgMBdIh6YhAbBHeAkAyGeFIQHQdia74wYI8jAYGgAT4lugAlYDgpKsoQG0yQWP1bg9WwBRRWBjtCGxHhjl+wDOCh+BgQQguUccIwRoO0td05wga4rGAhBVA75g4bX66GssAFEekPUDEQCOrjnWDoDThgd9qW6QIwA5jC/6GQYQfCVWtPdyHM4KsAKavxPMobKin8EQKOaGVkFq+d2fYn/5ngYgd4H4AFaA2AHy7a0AuQvEB7ACxA6Qb28FyF0gPoAVIHaAfHsrQO4C8QGsALED5NtbAXIXiA9gBYgdIN/eCpC7QHwAK0DsAPn2VoDcBeIDWAFiB8i3twLkLhAf4N8r4Bch+4Nf5+N6mQAAAABJRU5ErkJggg==';

let orthogonalStyle: Style | undefined;
function getOrthogonalStyle(): Style {
  if (!orthogonalStyle) {
    orthogonalStyle = new Style({
      image: new Icon({
        src: orothogonalSrc,
        scale: 0.25,
        anchor: [0.5, 1],
      }),
    });
  }
  return orthogonalStyle;
}

const parallelSrc =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAd1JREFUeJzt00EKwkAQRcFEPGyOpKfVE/iyiDIzWLVv+DS8bQMAAAAAAAAAAAAAAAAAAAAAAAAAAID/so8esIDj4v3jKys+m33f0gRy7nXx/tc/nn3f0m6jB8DMBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBAEAkEgEAQCQSAQBAJBIBDuowcs4Dl6wInZ9wEAAAAAAAAAAAAAAAAAAAAAAAAAAAALeQNcNQZTV+qErgAAAABJRU5ErkJggg==';

let parallelStyle: Style | undefined;
function getParallelStyle(): Style {
  if (!parallelStyle) {
    parallelStyle = new Style({
      image: new Icon({
        src: parallelSrc,
        scale: 0.1,
        anchor: [0.5, 1],
      }),
    });
  }
  return parallelStyle;
}

let vertexStyle: Style | undefined;
function getVertexStyle(): Style {
  if (!vertexStyle) {
    vertexStyle = new Style({
      image: new RegularShape({
        radius: 6,
        points: 4,
        fill: new Fill({
          color: [255, 255, 255, 0.4],
        }),
        stroke: new Stroke({
          color: blackColor,
          width: 1,
        }),
      }),
    });
  }
  return vertexStyle;
}

const FIVE_DEGREES = CesiumMath.toRadians(5);

function getClosestOrthogonal(
  start: Coordinate,
  end: Coordinate,
  point: Coordinate,
): Coordinate {
  scratchCartesian21 = Cartesian2.fromElements(
    end[0] - start[0],
    end[1] - start[1],
    scratchCartesian21,
  ); // segment;
  const matrix = Matrix2.fromArray([0, 1, -1, 0]);
  scratchCartesian22 = Matrix2.multiplyByVector(
    matrix,
    scratchCartesian21,
    scratchCartesian22,
  );
  scratchCartesian22 = Cartesian2.normalize(
    scratchCartesian22,
    scratchCartesian22,
  );
  scratchCartesian22 = Cartesian2.multiplyByScalar(
    scratchCartesian22,
    0.0001,
    scratchCartesian22,
  );

  const newSegment = [
    scratchCartesian22.x + end[0],
    scratchCartesian22.y + end[1],
    point[2],
  ];
  return getClosestPointOn2DLine(end, newSegment, point);
}

function findClosestOrthogonalOrLinear(
  start: Coordinate,
  end: Coordinate,
  point: Coordinate,
): Coordinate {
  const c1 = getClosestPointOn2DLine(start, end, point);
  const c2 = getClosestOrthogonal(start, end, point);
  const d1 = cartesian2DDistanceSquared(c1, point);
  const d2 = cartesian2DDistanceSquared(c2, point);
  if (d1 > d2) {
    return c2;
  }
  return c1;
}

/**
 * projects the point onto the imaginary line from origin in direction theta
 * @param origin
 * @param point
 * @param theta - direction from north in radians
 * @returns
 */
function getClosestInDirection(
  origin: Coordinate,
  point: Coordinate,
  theta: number,
): Coordinate {
  let alpha = theta + CesiumMath.PI_OVER_TWO;
  alpha = alpha > CesiumMath.TWO_PI ? alpha - CesiumMath.TWO_PI : alpha;
  const unityP1 = [
    origin[0] + 100 * Math.cos(alpha),
    origin[1] - 100 * Math.sin(alpha),
    origin[2],
  ];

  return getClosestPointOn2DLine(origin, unityP1, point);
}

function getOrthogonalSnapResult(
  coordinate: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  otherVertexIndex: number,
): SnapResult<'orthogonal'> | undefined {
  const currentBearing = getCartesianBearing(p1, coordinate);
  const previousBearing = getCartesianBearing(p2, p1);
  const previousBearingDiff = Math.abs(previousBearing - currentBearing);
  if (
    previousBearingDiff < FIVE_DEGREES || // 5
    (previousBearingDiff > CesiumMath.PI_OVER_TWO - FIVE_DEGREES &&
      previousBearingDiff < CesiumMath.PI_OVER_TWO + FIVE_DEGREES) || // 90 +/- 5
    (previousBearingDiff > CesiumMath.PI - FIVE_DEGREES &&
      previousBearingDiff < CesiumMath.PI + FIVE_DEGREES) || // 180 +/- 5
    (previousBearingDiff > CesiumMath.THREE_PI_OVER_TWO - FIVE_DEGREES &&
      previousBearingDiff < CesiumMath.THREE_PI_OVER_TWO + FIVE_DEGREES) || // 280 +/- 5
    previousBearingDiff > CesiumMath.TWO_PI - FIVE_DEGREES // 360 - 5
  ) {
    const snapped = findClosestOrthogonalOrLinear(p2, p1, coordinate);

    return {
      type: 'orthogonal',
      snapped,
      otherVertexIndex,
    };
  }

  return undefined;
}

function getParallelSnapResult(
  coordinate: Coordinate,
  p1: Coordinate,
  geometryBearings: number[],
  otherVertexIndex: number,
): SnapResult<'parallel'> | undefined {
  const currentBearing = getCartesianBearing(p1, coordinate);
  const bearingsLength = geometryBearings.length;
  for (let parallelIndex = 0; parallelIndex < bearingsLength; parallelIndex++) {
    const bearing = geometryBearings[parallelIndex];
    if (bearing >= 0) {
      const bearingDiff = Math.abs(bearing - currentBearing);
      if (
        bearingDiff < FIVE_DEGREES || // 5
        (bearingDiff > CesiumMath.PI - FIVE_DEGREES &&
          bearingDiff < CesiumMath.PI + FIVE_DEGREES) || // 180 +/- 5
        bearingDiff > CesiumMath.TWO_PI - FIVE_DEGREES // 360 - 5
      ) {
        const snapped = getClosestInDirection(p1, coordinate, bearing);
        return {
          type: 'parallel',
          snapped,
          otherVertexIndex,
          parallelIndex,
        };
      }
    }
  }

  return undefined;
}

/**
 * Try to create an orthogonal for p2 - p1 - coordinate. otherwise snaps p1 - coordinate to any of the given geometry bearings
 * @param coordinate
 * @param p1
 * @param p2
 * @param geometryBearings
 * @param otherVertexIndex
 * @param maxDistanceSquared
 * @param snapOrthogonal
 * @param snapParallel
 * @param heightReference
 */
export function getAngleSnapResult(
  coordinate: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  geometryBearings: number[],
  otherVertexIndex: number,
  maxDistanceSquared: number,
  snapOrthogonal = true,
  snapParallel = true,
  heightReference = HeightReference.CLAMP_TO_GROUND,
): SnapResult<'orthogonal' | 'parallel'> | undefined {
  let snapResult: SnapResult<'orthogonal' | 'parallel'> | undefined =
    snapOrthogonal
      ? getOrthogonalSnapResult(coordinate, p1, p2, otherVertexIndex)
      : undefined;

  if (!snapResult && snapParallel) {
    snapResult = getParallelSnapResult(
      coordinate,
      p1,
      geometryBearings,
      otherVertexIndex,
    );
  }

  const getDistanceSquared =
    coordinate.length === 2 || isClampedHeightReference(heightReference)
      ? cartesian2DDistanceSquared
      : cartesian3DDistanceSquared;

  if (
    snapResult?.snapped &&
    getDistanceSquared(snapResult.snapped, coordinate) <= maxDistanceSquared
  ) {
    return snapResult;
  }
  return undefined;
}

/**
 * Snaps to the vertices of the provided geometries, otherwise tries to snap to the edges.
 * @param geometries
 * @param coordinate
 * @param maxDistanceSquared
 * @param snapToVertex
 * @param snapToEdge
 * @param heightReference
 */
export function getGeometrySnapResult(
  geometries: Geometry[],
  coordinate: Coordinate,
  maxDistanceSquared: number,
  snapToVertex = true,
  snapToEdge = true,
  heightReference = HeightReference.CLAMP_TO_GROUND,
): SnapResult<'edge' | 'vertex'> | undefined {
  let distanceSquared = Infinity;
  let result: SnapResult<'vertex' | 'edge'> | undefined;

  const getDistanceSquared =
    coordinate.length === 2 || isClampedHeightReference(heightReference)
      ? cartesian2DDistanceSquared
      : cartesian3DDistanceSquared;

  if (snapToVertex) {
    geometries.forEach((geometry) => {
      const coordinates = geometry.getFlatCoordinates();
      const stride = geometry.getStride();

      const { length } = coordinates;
      for (let i = 0; i < length; i += stride) {
        const vertex = [coordinates[i], coordinates[i + 1]];
        if (stride > 2) {
          vertex[2] = coordinates[i + 2];
        }
        const currentDistanceSquared = getDistanceSquared(vertex, coordinate);

        if (
          currentDistanceSquared < distanceSquared &&
          currentDistanceSquared <= maxDistanceSquared
        ) {
          distanceSquared = currentDistanceSquared;
          if (!result) {
            result = {
              type: 'vertex',
              snapped: vertex,
            };
          } else {
            result.type = 'vertex';
            result.snapped = vertex;
          }
        }
      }
    });
  }

  if (!result && snapToEdge) {
    distanceSquared = Infinity;
    geometries.forEach((geometry) => {
      const closestPoint = geometry.getClosestPoint(coordinate);
      const currentDistanceSquared = getDistanceSquared(
        closestPoint,
        coordinate,
      );

      if (
        currentDistanceSquared < distanceSquared &&
        currentDistanceSquared <= maxDistanceSquared
      ) {
        distanceSquared = currentDistanceSquared;
        if (!result) {
          result = {
            type: 'edge',
            snapped: closestPoint,
          };
        } else {
          result.type = 'edge';
          result.snapped = closestPoint;
        }
      }
    });
  }

  return result;
}

export function setSnappingFeatures(
  results: (SnapResult | undefined)[],
  coordinates: Coordinate[],
  layer: VectorLayer,
): () => void {
  const features = results
    .map((result) => {
      let feature: Feature | undefined;
      if (result?.type === 'orthogonal' && result.otherVertexIndex > -1) {
        feature = new Feature({
          geometry: new Point(coordinates[result.otherVertexIndex]),
        });
        feature.setStyle(getOrthogonalStyle);
      } else if (result?.type === 'parallel' && result.parallelIndex > -1) {
        const { parallelIndex } = result;
        const other =
          parallelIndex !== coordinates.length - 1 ? parallelIndex + 1 : 0;
        const midPoint = getMidPoint(
          coordinates[parallelIndex],
          coordinates[other],
        );
        feature = new Feature({
          geometry: new Point(midPoint),
        });
        feature.setStyle(getParallelStyle());
      } else if (result?.type === 'vertex') {
        feature = new Feature({
          geometry: new Point(result.snapped),
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.BOX,
            geometryOptions: {
              minimum: [-3, -3, -3],
              maximum: [3, 3, 3],
            },
            depthFailColor: 'rgba(150,147,147,0.47)',
          },
          olcs_modelAutoScale: true,
        });
        feature.setStyle(getVertexStyle());
      } else if (result?.type === 'edge') {
        feature = new Feature({
          geometry: new Point(result.snapped),
          olcs_primitiveOptions: {
            type: PrimitiveOptionsType.SPHERE,
            geometryOptions: {
              radius: 3,
            },
            depthFailColor: 'rgba(150,147,147,0.47)',
          },
          olcs_modelAutoScale: true,
        });
      }

      if (feature) {
        const geometry = feature.getGeometry()!;
        geometry[alreadyTransformedToImage] = true;
        geometry[alreadyTransformedToMercator] = true;
        feature[doNotTransform] = true;
      }
      return feature;
    })
    .filter((f): f is Feature => !!f);

  if (isRelativeHeightReference(layer.vectorProperties.altitudeMode)) {
    features.forEach((feature) => {
      feature.set('olcs_altitudeMode', 'absolute');
    });
  }
  layer.addFeatures(features);

  return () => {
    layer.removeFeaturesById(features.map((f) => f.getId()!));
  };
}

export function getSnappedCoordinateForResults(
  results: (SnapResult | undefined)[],
  coordinates: Coordinate[],
  maxDistanceSquared: number,
): Coordinate | undefined {
  const snapped0 = results[0]?.snapped;
  const snapped1 = results[1]?.snapped;

  if (
    snapped0 &&
    snapped1 &&
    (results[0]!.type === 'orthogonal' || results[0]!.type === 'parallel') &&
    (results[1]!.type === 'orthogonal' || results[1]!.type === 'parallel')
  ) {
    const other0 = coordinates[results[0]!.otherVertexIndex];
    const other1 = coordinates[results[1]!.otherVertexIndex];
    if (other0 && other1) {
      const intersection = cartesian2Intersection(
        [snapped0, other0],
        [snapped1, other1],
      );
      if (
        intersection &&
        cartesian2DDistanceSquared(intersection, snapped0) <= maxDistanceSquared
      ) {
        return [intersection[0], intersection[1], snapped0[2]];
      }
    }
  }

  if (snapped1) {
    return snapped1;
  }

  if (snapped0) {
    return snapped0;
  }

  return undefined;
}
