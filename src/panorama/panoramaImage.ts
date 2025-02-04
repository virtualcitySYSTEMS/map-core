import {
  Cartesian3,
  Matrix4,
  Transforms,
  HeadingPitchRoll,
  Cartesian4,
} from '@vcmap-cesium/engine';
import { fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff';
import {
  createPanoramaTileProvider,
  PanoramaTileProvider,
} from './panoramaTileProvider.js';
import type { TileSize } from './panoramaTile.js';

export type PanoramaImageOptions = {
  rootUrl: string;
  name: string;
  position: { x: number; y: number; z: number };
  orientation: { heading: number; pitch: number; roll: number };
};

type PanoramaImageMetadata = {
  tileSize: TileSize;
  minLevel: number;
  maxLevel: number;
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
  readonly up: Cartesian3;
  readonly invModelMatrix: Matrix4;
  // the following properties are "tiled" specific
  readonly image: GeoTIFF;
  readonly tileProvider: PanoramaTileProvider;
  readonly tileSize: TileSize;
  readonly minLevel: number;
  readonly maxLevel: number;
  destroy(): void;
};

async function loadRGBImages(
  rootUrl: string,
): Promise<{ image: GeoTIFF; rgb: GeoTIFFImage[] } & PanoramaImageMetadata> {
  const image = await fromUrl(rootUrl);
  let imageCount = await image.getImageCount();
  const promises = [];
  while (imageCount) {
    imageCount -= 1;
    promises.push(image.getImage(imageCount));
  }
  const rgb = await Promise.all(promises);
  const minLevelImage = rgb[0];
  const tileSize: TileSize = [
    minLevelImage.getTileWidth(),
    minLevelImage.getTileHeight(),
  ];

  const minLevel = minLevelImage.getHeight() / tileSize[0] - 1;
  const maxLevel = rgb.length - 1 + minLevel;
  return { image, rgb, tileSize, minLevel, maxLevel };
}

export async function createPanoramaImage(
  options: PanoramaImageOptions,
): Promise<PanoramaImage> {
  const { rootUrl, name, position, orientation } = options;
  const { image, rgb, tileSize, minLevel, maxLevel } = await loadRGBImages(
    `${rootUrl}/${name}/rgb.tif`,
  );

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

  const upCart4 = Matrix4.getColumn(modelMatrix, 2, new Cartesian4());
  Cartesian4.normalize(upCart4, upCart4);
  const up = Cartesian3.fromCartesian4(upCart4, new Cartesian3());

  const invModelMatrix = Matrix4.inverseTransformation(
    modelMatrix,
    new Matrix4(),
  );

  const tileProvider = createPanoramaTileProvider(
    rgb,
    cartesianPosition,
    tileSize,
    minLevel,
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
    get up(): Cartesian3 {
      return up;
    },
    get invModelMatrix(): Matrix4 {
      return invModelMatrix;
    },
    get tileProvider(): PanoramaTileProvider {
      return tileProvider;
    },
    get image(): GeoTIFF {
      return image;
    },
    get tileSize(): TileSize {
      return tileSize;
    },
    get minLevel(): number {
      return minLevel;
    },
    get maxLevel(): number {
      return maxLevel;
    },
    destroy(): void {
      tileProvider.destroy();
      image.close();
    },
  };
}
