import {
  Cartesian3,
  Matrix4,
  PrimitiveCollection,
  Scene,
} from '@vcmap-cesium/engine';
import type { PanoramaImage } from './panoramaImage.js';
import type { PanoramaTile, TileCoordinate } from './panoramaTile.js';

export type PanoramaImageView = {
  image: PanoramaImage;
  destroy(): void;
};

const baseTileCoordinates: TileCoordinate[] = [
  [0, 0, 0],
  [1, 0, 0],
];

export function createPanoramaImageView(
  scene: Scene,
  image: PanoramaImage,
): PanoramaImageView {
  const primitiveCollection = scene.primitives.add(
    new PrimitiveCollection({ destroyPrimitives: false, show: true }),
  ) as PrimitiveCollection;
  let currentTileCoordinates: TileCoordinate[] = [...baseTileCoordinates];
  const currentTiles = new Map<string, PanoramaTile>();
  image.tileProvider.tileLoaded.addEventListener((tile) => {
    if (!currentTiles.has(tile.key)) {
      currentTiles.set(tile.key, tile);
      if (tile.getTileCoordinate()[2] === 0) {
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

  scene.camera.setView({
    destination: image.position,
    orientation: {
      heading: 0,
      pitch: 0,
      roll: 0,
    },
  });

  scene.camera.changed.addEventListener(() => {
    // update tiles to render
  });

  return {
    image,
    destroy(): void {
      scene.primitives.remove(primitiveCollection);
      currentTiles.clear();
    },
  };
}
