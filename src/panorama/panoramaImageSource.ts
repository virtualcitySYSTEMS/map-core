import { Cartesian3, PrimitiveCollection, Scene } from '@vcmap-cesium/engine';
import { createTilesForLevel, PanoramaTile } from './panoramaTile.js';

/**
 * idea:
 * - we use a global TMS tiling structure with two level zero tiles.
 * - the image we are trying to render spans the entire globe (in our case sphere)
 * - given a specific tile size, each level has a specific meter per pixel value
 * - given the fov of the camera, we can determine the scene current meters per pixel (if the sphere where the world)
 * - we can determine the current _level_ by using the next best meters per pixel.
 * - we can determine which tiles to load by using the cameras heading & FOV
 */

/**
 * - use haversine distance (or cartesisan distance in 3D space) to determine distance between tile borders
 */

type LevelTiles = {
  primitives: PrimitiveCollection;
  tiles: Map<string, PanoramaTile>;
};

function createTileLevel(level: number, position: Cartesian3): LevelTiles {
  const primitives = new PrimitiveCollection();
  primitives.show = false;
  const tiles = new Map<string, PanoramaTile>();
  // const tile = new PanoramaTile(0, 0, level, this._position);
  createTilesForLevel(level, position).forEach((tile) => {
    primitives.add(tile.primitive);
    tiles.set(tile.getTileCoordinate().join('/'), tile);
  });
  return { primitives, tiles };
}

export function createPanoramaImageSource(
  scene: Scene,
  maxLevel: number,
  position: Cartesian3,
): () => void {
  const primitiveCollection = new PrimitiveCollection();

  scene.primitives.add(primitiveCollection); // camera changed listener

  const levelCollections = new Map<number, LevelTiles>();

  for (let i = 0; i <= maxLevel; i++) {
    const tileLevel = createTileLevel(i, position);
    levelCollections.set(i, tileLevel);
    primitiveCollection.add(tileLevel.primitives);
  }

  levelCollections.get(4)!.primitives.show = true;

  return () => {
    primitiveCollection.removeAll();
    scene.primitives.remove(primitiveCollection);
  };
}
