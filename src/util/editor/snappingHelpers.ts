import { Coordinate } from 'ol/coordinate.js';
import { Icon, Style } from 'ol/style.js';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { Cartesian2, Matrix2, Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  cartesian2DDistance,
  cartesian2Intersection,
  getCartesianBearing,
  getMidPoint,
} from '../math.js';
import { getClosestPointOn2DLine } from './editorHelpers.js';
import VcsMap from '../../map/vcsMap.js';
import VectorLayer from '../../layer/vectorLayer.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
} from '../../layer/vectorSymbols.js';

export type SnapResult = {
  toParallel?: number;
  toOrthogonal?: number;
  snapped?: Coordinate;
  orthogonalIndex?: number;
};

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
  const d1 = cartesian2DDistance(c1, point);
  const d2 = cartesian2DDistance(c2, point);
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

function snapToGeometry(
  coordinate: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  geometryBearings: number[],
  orthogonalIndex: number,
): SnapResult {
  let snapped;
  let toOrthogonal: number | undefined;
  let toParallel: number | undefined;

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
    snapped = findClosestOrthogonalOrLinear(p2, p1, coordinate);
    toOrthogonal = orthogonalIndex;
  } else {
    toParallel = geometryBearings.findIndex((bearing) => {
      if (bearing < 0) {
        return false;
      }
      const bearingDiff = Math.abs(bearing - currentBearing);
      if (
        bearingDiff < FIVE_DEGREES || // 5
        (bearingDiff > CesiumMath.PI - FIVE_DEGREES &&
          bearingDiff < CesiumMath.PI + FIVE_DEGREES) || // 180 +/- 5
        bearingDiff > CesiumMath.TWO_PI - FIVE_DEGREES // 360 - 5
      ) {
        snapped = getClosestInDirection(p1, coordinate, bearing);
        return true;
      }
      return false;
    });
  }

  return {
    snapped,
    toParallel,
    toOrthogonal,
    orthogonalIndex,
  };
}

export function getSnapResultForSegment(
  coordinate: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  geometryBearings: number[],
  orthogonalIndex: number,
  map: VcsMap,
): SnapResult | undefined {
  const snapResult = snapToGeometry(
    coordinate,
    p1,
    p2,
    geometryBearings,
    orthogonalIndex,
  );

  if (
    snapResult.snapped &&
    cartesian2DDistance(snapResult.snapped, coordinate) <=
      map.getCurrentResolution(coordinate) * 12
  ) {
    return snapResult;
  }
  return undefined;
}

export function setSnappingFeatures(
  results: (SnapResult | undefined)[],
  coordinates: Coordinate[],
  layer: VectorLayer,
): () => void {
  const features = results
    .map((result) => {
      let feature: Feature | undefined;
      if (result?.toOrthogonal != null && result.toOrthogonal > -1) {
        feature = new Feature({
          geometry: new Point(coordinates[result.toOrthogonal]),
        });
        feature.setStyle(getOrthogonalStyle);
      } else if (result?.toParallel != null && result.toParallel > -1) {
        const parallelIndex = result.toParallel;
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
      }

      if (feature) {
        const geometry = feature.getGeometry()!;
        geometry[alreadyTransformedToImage] = true;
        geometry[alreadyTransformedToMercator] = true;
      }
      return feature;
    })
    .filter((f): f is Feature => !!f);

  layer.addFeatures(features);
  return () => {
    layer.removeFeaturesById(features.map((f) => f.getId()!));
  };
}

export function getSnappedCoordinateForResults(
  results: (SnapResult | undefined)[],
  coordinates: Coordinate[],
): Coordinate | undefined {
  const snapped0 = results[0]?.snapped;
  const snapped1 = results[1]?.snapped;

  if (snapped0 && snapped1) {
    const other0 = coordinates[results[0]!.orthogonalIndex!];
    const other1 = coordinates[results[1]!.orthogonalIndex!];
    if (other0 && other1) {
      const intersection = cartesian2Intersection(
        [snapped0, other0],
        [snapped1, other1],
      );
      if (intersection) {
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
