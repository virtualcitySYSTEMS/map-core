import { Color } from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol/index.js';

/**
 * Handlers are map specific transformation handlers wich enable the use of the transformation interactions.
 * There visualization is {@link TransformationMode} specific. Do not create these handlers yourself
 * use {@link createTransformationHandler} instead.
 */
export type Handlers = {
  show: boolean;
  /**
   * update the center of the handlers
   */
  setCenter(center: Coordinate): void;
  /**
   * highlight the given axis
   */
  showAxis: AxisAndPlanes;
  /**
   * display Z axis handlers in grey and do not allow them to be picked
   */
  greyOutZ: boolean;
  destroy(): void;
};

export type TransformationHandler = {
  translate(x: number, y: number, z: number): void;
  /**
   * Copy of the handlers current center
   */
  readonly center: Coordinate;
  showAxis: AxisAndPlanes;
  showing: boolean;
  setFeatures(feature: Feature[]): void;
  destroy(): void;
};

export enum AxisAndPlanes {
  X = 'X',
  Y = 'Y',
  Z = 'Z',
  XY = 'XY',
  XZ = 'XZ',
  YZ = 'YZ',
  XYZ = 'XYZ',
  NONE = 'NONE',
}
export enum TransformationMode {
  TRANSLATE = 'translate',
  ROTATE = 'rotate',
  SCALE = 'scale',
  EXTRUDE = 'extrude',
}

export const greyedOutColor = Color.GRAY.withAlpha(0.5);

export function is1DAxis(axis: AxisAndPlanes): boolean {
  return (
    axis === AxisAndPlanes.X ||
    axis === AxisAndPlanes.Y ||
    axis === AxisAndPlanes.Z
  );
}

export function is2DAxis(axis: AxisAndPlanes): boolean {
  return (
    axis === AxisAndPlanes.XY ||
    axis === AxisAndPlanes.XZ ||
    axis === AxisAndPlanes.YZ
  );
}

export function is3DAxis(axis: AxisAndPlanes): boolean {
  return axis === AxisAndPlanes.XYZ;
}
