import { parseInteger, parseNumber } from '@vcsuite/parsers';
import { check } from '@vcsuite/check';
import type { Coordinate } from 'ol/coordinate.js';
import {
  Cartesian2,
  Cartesian3,
  CatmullRomSpline,
  Matrix3,
} from '@vcmap-cesium/engine';
import { LineString, type Geometry } from 'ol/geom.js';
import { unByKey } from 'ol/Observable.js';
import type { Feature } from 'ol/index.js';
import type { EventsKey } from 'ol/events.js';
import type { GeometryFunction } from 'ol/style/Style.js';

import { v4 as uuidv4 } from 'uuid';
import { cartesian2DDistance, getMidPoint, modulo } from '../util/math.js';
import ArrowStyle, { type ArrowStyleOptions } from './arrowStyle.js';

export type ArcStyleOptions = ArrowStyleOptions & {
  /**
   * actor to calculate the 'height' of an arc, based on the distance from start to end
   * @default 0.15
   */
  arcFactor?: number;
  /**
   * number of segments to interpolate the arc by
   * @default 64
   */
  numberOfSegments?: number;
  /**
   * offset in m(mercator) from the arc end and arc start to the start/end points Is only rendered if offset * 2 < distance between start and endpoint
   * @default 0
   */
  offset?: number;
};

export type ArcStruct = {
  /**
   * undefined if not an arc
   */
  geometry?: LineString | Geometry;
  /**
   * undefined if not an arc
   */
  coordinates?: Coordinate[];
  destroy: () => void;
};

/**
 * Added to feature to hold there respective arc structure
 */
export const featureArcStruct: unique symbol = Symbol('FeatureArcStruct');

/**
 * Added to features to indicate to which arc style there ArcStruct belongs. If the style changes or a new ArcStyle is applied
 * to the feature, its value will change, recalculating the ArcStruct
 */
const featureArcStyleId: unique symbol = Symbol('ArcStyleId');

/**
 * Gets the radius of the circle covering p1, p2, p3. see https://math.stackexchange.com/a/1460096
 */
function determineCircle(
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
): { center: Coordinate; radius: number } | null {
  const m11 = Matrix3.determinant(
    new Matrix3(p1[0], p1[1], 1, p2[0], p2[1], 1, p3[0], p3[1], 1),
  );
  if (m11 === 0) {
    return null;
  }
  const m12 = Matrix3.determinant(
    new Matrix3(
      p1[0] ** 2 + p1[1] ** 2,
      p1[1],
      1,
      p2[0] ** 2 + p2[1] ** 2,
      p2[1],
      1,
      p3[0] ** 2 + p3[1] ** 2,
      p3[1],
      1,
    ),
  );

  const m13 = Matrix3.determinant(
    new Matrix3(
      p1[0] ** 2 + p1[1] ** 2,
      p1[0],
      1,
      p2[0] ** 2 + p2[1] ** 2,
      p2[0],
      1,
      p3[0] ** 2 + p3[1] ** 2,
      p3[0],
      1,
    ),
  );

  const center = [0.5 * (m12 / m11), -0.5 * (m13 / m11)];

  return {
    center,
    radius: cartesian2DDistance(center, p1),
  };
}

/**
 * Determines the midpoint of a line with a distance. see https://gamedev.stackexchange.com/questions/70075/how-can-i-find-the-perpendicular-to-a-2d-vector
 */
function getMidPointOnArc(
  p1: Coordinate,
  p2: Coordinate,
  arcHeight: number,
): Coordinate {
  const lineVector = new Cartesian2(p2[0] - p1[0], p2[1] - p1[1]);
  let perp = Cartesian2.normalize(lineVector, new Cartesian2());
  const { x, y } = perp;
  perp = new Cartesian2(y, -x);
  Cartesian2.multiplyByScalar(perp, arcHeight, perp);
  const midPoint = getMidPoint(p1, p2);
  Cartesian2.add(perp, new Cartesian2(midPoint[0], midPoint[1]), perp);
  return [perp.x, perp.y];
}

function determineQuadrantOffset(
  center: Coordinate,
  coordinate: Coordinate,
  angle: number,
): number {
  if (center[1] <= coordinate[1]) {
    return angle;
  }
  return Math.PI + (Math.PI - angle);
}

function interpolateBetweenAngles(
  p1: Coordinate,
  p2: Coordinate,
  center: Coordinate,
  radius: number,
  numberOfSegments: number,
  offset: number,
): Coordinate[] {
  const zeroVector = Cartesian2.UNIT_X;
  const p1V = new Cartesian2(p1[0] - center[0], p1[1] - center[1]);
  const p2V = new Cartesian2(p2[0] - center[0], p2[1] - center[1]);
  let startAngle = Cartesian2.angleBetween(zeroVector, p1V);
  startAngle = determineQuadrantOffset(center, p1, startAngle);
  let distance = Cartesian2.angleBetween(p1V, p2V);
  const coordinates = new Array(numberOfSegments) as Coordinate[];
  const offsetAngle = offset / radius;
  startAngle += offsetAngle;
  distance -= offsetAngle * 2;

  for (let i = 0; i <= numberOfSegments; ++i) {
    const angle =
      startAngle +
      (modulo(i, numberOfSegments + 1) * distance) / numberOfSegments;
    coordinates[i] = [
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
      0,
    ];
  }
  return coordinates;
}

function getArcCoordinates(
  p1: Coordinate,
  p2: Coordinate,
  arcHeight: number,
  numberOfSegments: number,
  arcFactor: number,
  offset: number,
): Coordinate[] {
  const midPoint = getMidPoint(p1, p2);
  midPoint[2] = midPoint[2] ?? 0;
  midPoint[2] += arcHeight / 2;
  const fullDistance = cartesian2DDistance(p1, p2);

  const p1Cartesian = new Cartesian3(p1[0], p1[1], p1[2] ?? 0);
  const midPointCartesian = new Cartesian3(
    midPoint[0],
    midPoint[1],
    midPoint[2] ?? 0,
  );
  const p2Cartesian = new Cartesian3(p2[0], p2[1], p2[2] ?? 0);
  let points;
  if (offset > 0) {
    const distanceP1Midpoint = Cartesian3.distance(
      p1Cartesian,
      midPointCartesian,
    );
    const offsetNumber = (1 / distanceP1Midpoint) * offset;

    const arcHeightCorrection = arcHeight / 4;
    const offsetHeightCorrection =
      (offsetNumber > 0.5 ? Math.abs(1 - offsetNumber) : offsetNumber) *
      arcHeightCorrection;
    const newP1 = Cartesian3.lerp(
      p1Cartesian,
      midPointCartesian,
      offsetNumber,
      new Cartesian3(),
    );
    newP1.z += offsetHeightCorrection;
    const newP2 = Cartesian3.lerp(
      p2Cartesian,
      midPointCartesian,
      offsetNumber,
      new Cartesian3(),
    );
    newP2.z += offsetHeightCorrection;
    points = [newP1, midPointCartesian, newP2];
  } else {
    points = [p1Cartesian, midPointCartesian, p2Cartesian];
  }

  const distance = (fullDistance - offset * 2) / 64;
  const spline = new CatmullRomSpline({
    times: [0, 0.5, 1],
    points,
    firstTangent: new Cartesian3(0, 0, arcFactor * distance),
    lastTangent: new Cartesian3(0, 0, -arcFactor * distance),
  });

  const coordinates = new Array(numberOfSegments + 1) as Coordinate[];
  let scratchCartesian = new Cartesian3();
  for (let i = 0; i <= numberOfSegments; i++) {
    scratchCartesian = spline.evaluate(i / numberOfSegments, scratchCartesian);
    coordinates[i] = [
      scratchCartesian.x,
      scratchCartesian.y,
      scratchCartesian.z,
    ];
  }
  return coordinates;
}

/**
 * Set the ArcStruct on the feature
 */
function createFeatureArc(
  arcFactor: number,
  feature: Feature,
  numberOfSegments: number,
  offset: number,
): void {
  if (feature[featureArcStruct]) {
    feature[featureArcStruct].destroy();
  }
  const geometry = feature.getGeometry();
  const listeners: EventsKey[] = [];
  const destroy = (): void => {
    unByKey(listeners);
  };
  listeners.push(
    feature.on('change:geometry', () => {
      createFeatureArc(arcFactor, feature, numberOfSegments, offset);
    }),
  );

  if (geometry instanceof LineString) {
    listeners.push(
      geometry.on('change', () => {
        createFeatureArc(arcFactor, feature, numberOfSegments, offset);
      }),
    );
    const p1 = geometry.getFirstCoordinate();
    const p2 = geometry.getLastCoordinate();
    const distance = cartesian2DDistance(p1, p2);
    const arcHeight = distance * arcFactor;
    // check offset validity
    let validOffset = offset;
    if (offset * 2 > distance) {
      validOffset = 0;
    }
    const midPoint = getMidPointOnArc(p1, p2, arcHeight);
    const circleDetermine = determineCircle(p1, p2, midPoint);
    if (!circleDetermine) {
      feature[featureArcStruct] = {
        geometry,
        destroy,
      };
      return;
    }
    const { center, radius } = circleDetermine;

    const coordinates = interpolateBetweenAngles(
      p1,
      p2,
      center,
      radius,
      numberOfSegments,
      validOffset,
    );
    const c = getArcCoordinates(
      p1,
      p2,
      arcHeight,
      numberOfSegments,
      arcFactor,
      validOffset,
    );
    feature[featureArcStruct] = {
      geometry: new LineString(coordinates),
      coordinates: c,
      destroy,
    };
  } else {
    feature[featureArcStruct] = {
      geometry,
      destroy,
    };
  }
}

/**
 * A style which applies an arc to LineString geometries depending on their first and last coordinates.
 * All other coordinates will be ignored. This still will
 * not render non-LineString geometries (same as {@link ArrowStyle}).
 */
class ArcStyle extends ArrowStyle {
  private _arcFactor: number;

  /**
   * This styles revision ID. This will enforce an update of a features arc struct, if the feature get applied a new ArcStyle
   */
  private _revisionId = uuidv4();

  /**
   * The number of line segments to interpolate by
   */
  private _numberOfSegments: number;

  private _offset: number;

  /**
   * @param  [options=]
   */
  constructor(options: ArcStyleOptions = {}) {
    super(options);
    this._arcFactor = parseNumber(options.arcFactor, 0.15);
    this._numberOfSegments = parseInteger(options.numberOfSegments, 64);
    this._offset = parseNumber(options.offset, 0);

    this.setGeometry(
      this._getFeatureArcGeometry.bind(this) as GeometryFunction,
    );
  }

  /**
   * The number of segments to render the arc with.
   */
  get numberOfSegments(): number {
    return this._numberOfSegments;
  }

  set numberOfSegments(value: number) {
    check(value, Number);
    if (
      value !== this._numberOfSegments &&
      value > 0 &&
      Number.isInteger(value)
    ) {
      this._numberOfSegments = value;
      this._revisionId = uuidv4();
    }
  }

  /**
   * An offset from the arc end/start to the starting point / end point
   */
  get offset(): number {
    return this._offset;
  }

  set offset(value: number) {
    check(value, Number);
    if (value !== this._offset && value > 0) {
      this._offset = value;
      this._revisionId = uuidv4();
    }
  }

  /**
   * The factor with which to calculate the 'height' of an arc using the distance from start to end of the LineString.
   */
  get arcFactor(): number {
    return this._arcFactor;
  }

  set arcFactor(value: number) {
    check(value, Number);
    if (value !== this._arcFactor) {
      this._arcFactor = value;
      this._revisionId = uuidv4();
    }
  }

  private _getFeatureArcGeometry(
    feature: Feature & { [featureArcStyleId]?: string },
  ): Geometry | undefined {
    if (
      !feature[featureArcStruct] ||
      feature[featureArcStyleId] !== this._revisionId
    ) {
      createFeatureArc(
        this._arcFactor,
        feature,
        this._numberOfSegments,
        this._offset,
      );
      feature[featureArcStyleId] = this._revisionId;
    }
    return feature[featureArcStruct]?.geometry;
  }

  protected _getCloneOptions(): ArcStyleOptions {
    const options: ArcStyleOptions = super._getCloneOptions();
    options.arcFactor = this._arcFactor;
    options.numberOfSegments = this._numberOfSegments;
    return options;
  }

  clone(): ArcStyle {
    return new ArcStyle(this._getCloneOptions());
  }
}

export default ArcStyle;
