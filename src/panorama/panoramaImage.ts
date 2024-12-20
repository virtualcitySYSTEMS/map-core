import {
  Cartesian3,
  Matrix4,
  Transforms,
  HeadingPitchRoll,
} from '@vcmap-cesium/engine';

export type PanoramaImageOptions = {
  rootUrl: string;
  name: string;
  position: { x: number; y: number; z: number };
  orientation: { heading: number; pitch: number; roll: number };
};

export type PanoramaImage = {
  readonly rootUrl: string;
  readonly name: string;
  /**
   * position ECEF
   */
  readonly position: Cartesian3;
  /**
   * HeadingPitchRoll in radians
   */
  readonly orientation: HeadingPitchRoll;
  readonly modelMatrix: Matrix4;
  readonly invModelMatrix: Matrix4;
};

export function createPanoramaImage(
  options: PanoramaImageOptions,
): PanoramaImage {
  const { rootUrl, name, position, orientation } = options;

  const cartesianPosition = Cartesian3.fromDegrees(
    position.x,
    position.y,
    position.z,
  );
  const headingPitchRoll = HeadingPitchRoll.fromDegrees(
    orientation.heading,
    orientation.pitch,
    orientation.roll,
  );
  const modelMatrix = Transforms.headingPitchRollToFixedFrame(
    cartesianPosition,
    headingPitchRoll,
  );

  const invModelMatrix = Matrix4.inverseTransformation(
    modelMatrix,
    new Matrix4(),
  );

  return {
    get rootUrl(): string {
      return rootUrl;
    },
    get name(): string {
      return name;
    },
    get position(): Cartesian3 {
      return cartesianPosition;
    },
    get orientation(): HeadingPitchRoll {
      return headingPitchRoll;
    },
    get modelMatrix(): Matrix4 {
      return modelMatrix;
    },
    get invModelMatrix(): Matrix4 {
      return invModelMatrix;
    },
  };
}
