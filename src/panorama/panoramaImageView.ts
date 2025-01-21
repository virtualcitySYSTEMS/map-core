import {
  Cartesian3,
  Matrix4,
  PrimitiveCollection,
  Scene,
} from '@vcmap-cesium/engine';
import { getWidth } from 'ol/extent.js';
import type { PanoramaImage } from './panoramaImage.js';
import {
  createTileCoordinate,
  getTileCoordinatesInImageExtent,
  PanoramaTile,
  TileCoordinate,
  TileSize,
  tileSizeInRadians,
} from './panoramaTile.js';
import { getFovImageSphericalExtent } from './fovHelpers.js';

export type PanoramaImageView = {
  image: PanoramaImage;
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  destroy(): void;
  /**
   * force a render of the panorama image
   */
  render(): void;
};

const baseTileCoordinates: TileCoordinate[] = [
  createTileCoordinate(0, 0, 0),
  createTileCoordinate(1, 0, 0),
];

function getLevelPixelPerRadians(level: number, tileSize: TileSize): number {
  return tileSize[0] / tileSizeInRadians(level);
}

export function createPanoramaImageView(
  scene: Scene,
  image: PanoramaImage,
  maxLevel: number,
): PanoramaImageView {
  const primitiveCollection = scene.primitives.add(
    new PrimitiveCollection({ destroyPrimitives: false, show: true }),
  ) as PrimitiveCollection;
  let currentTileCoordinates: TileCoordinate[] = [...baseTileCoordinates];
  const currentTiles = new Map<string, PanoramaTile>();
  image.tileProvider.tileLoaded.addEventListener((tile) => {
    if (!currentTiles.has(tile.tileCoordinate.key)) {
      currentTiles.set(tile.tileCoordinate.key, tile);
      if (tile.tileCoordinate.level === 0) {
        tile.primitive.modelMatrix = Matrix4.multiplyByScale(
          tile.primitive.modelMatrix,
          new Cartesian3(1.01, 1.01, 1.01),
          new Matrix4(),
        );
      }
      primitiveCollection.add(tile.primitive);
    }
  });
  image.tileProvider.loadTiles(currentTileCoordinates);

  const { camera } = scene;
  camera.setView({
    destination: image.position,
    orientation: {
      heading: 0,
      pitch: 0,
      roll: 0,
    },
  });

  const { tileSize } = image.tileProvider;
  const levelPixelPerRadians = new Array<number>(maxLevel); // XXX can be cached or pre calculated?
  for (let i = 0; i <= maxLevel; i++) {
    levelPixelPerRadians[i] = getLevelPixelPerRadians(i, tileSize);
  }
  let suspendTileLoading = false;
  const render = (): void => {
    if (suspendTileLoading) {
      return;
    }
    const extents = getFovImageSphericalExtent(camera, image);
    const currentImageRadiansWidth = extents.reduce(
      (acc, extent) => acc + getWidth(extent),
      0,
    );
    const currentScenePixelWidth = scene.canvas.width;
    const currentRadiansPerPixel =
      currentScenePixelWidth / currentImageRadiansWidth;
    let currentLevel = 0;
    if (currentRadiansPerPixel > levelPixelPerRadians[maxLevel]) {
      currentLevel = maxLevel;
    } else if (currentRadiansPerPixel > levelPixelPerRadians[0]) {
      currentLevel = levelPixelPerRadians.findIndex(
        (rpp) => rpp >= currentRadiansPerPixel,
      );
    }

    currentTileCoordinates = [
      ...baseTileCoordinates,
      ...extents.flatMap((e) =>
        getTileCoordinatesInImageExtent(e, currentLevel),
      ),
    ];

    currentTiles.forEach((tile) => {
      if (
        !currentTileCoordinates.find((c) => c.key === tile.tileCoordinate.key)
      ) {
        primitiveCollection.remove(tile.primitive);
        currentTiles.delete(tile.tileCoordinate.key);
      }
    });

    image.tileProvider.loadTiles(currentTileCoordinates);
  };
  camera.changed.addEventListener(render);
  render();

  return {
    image,
    destroy(): void {
      scene.primitives.remove(primitiveCollection);
      currentTiles.clear();
    },
    get suspendTileLoading(): boolean {
      return suspendTileLoading;
    },
    set suspendTileLoading(value: boolean) {
      suspendTileLoading = value;
    },
    render,
  };
}
