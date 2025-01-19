import {
  Cartesian3,
  Matrix4,
  Transforms,
  HeadingPitchRoll,
} from '@vcmap-cesium/engine';
import {
  createPanoramaTileProvider,
  PanoramaTileProvider,
} from './panoramaTileProvider.js';

export type PanoramaImageOptions = {
  rootUrl: string;
  name: string;
  position: { x: number; y: number; z: number };
  orientation: { heading: number; pitch: number; roll: number };
};

export type PanoramaImage = {
  /**
   * The root URL, without trailing slash
   */
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
  readonly tileProvider: PanoramaTileProvider;
  destroy(): void;
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

  const tileProvider = createPanoramaTileProvider(
    'static',
    `${rootUrl}/${name}`,
    cartesianPosition,
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
    get tileProvider(): PanoramaTileProvider {
      return tileProvider;
    },
    destroy(): void {
      tileProvider.destroy();
    },
  };
}
