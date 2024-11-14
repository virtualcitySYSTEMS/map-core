// @ts-nocheck
import { Cartesian3, PrimitiveCollection, Scene } from '@vcmap-cesium/engine';
import { Size } from 'ol/size.js';
import PanoramaImage from './panoramaImage.js';
import PanoramaTile, { createTilesForLevel } from './panoramaTile.js';

/**
 * idea:
 * - we use a global TMS tiling structure with two level zero tiles.
 * - the image we are trying to render spans the entire globe (in our case sphere)
 * - given a specific tile size, each level has a specific meter per pixel value
 * - given the fov of the camera, we can determine the scene current meters per pixel (if the sphere where the world)
 * - we can determine the current _level_ by using the next best meters per pixel.
 * - we can determine which tiles to load by using the cameras heading & FOV
 */

export class PanoramaImageSource {
  private _primitiveCollection = new PrimitiveCollection();

  private _cameraChangedListener: (() => void) | undefined;

  private _currentImage: PanoramaImage | undefined;

  private _level = 0;

  private _renderingTiles = new Set<string>();

  private _tileSize: Size = [256, 256];

  private _levelCollections: Map<
    number,
    { primitives: PrimitiveCollection; tiles: Map<string, PanoramaTile> }
  > = new Map();

  constructor(
    private _scene: Scene,
    maxLevel: number,
    private _position: Cartesian3,
  ) {
    this._scene.primitives.add(this._primitiveCollection);
    this._cameraChangedListener = this._scene.camera.changed.addEventListener(
      this._cameraChanged.bind(this),
    );

    this._addLevel(0);
    /*
    for (let i = 0; i <= maxLevel; i++) {
      this._addLevel(i);
    }
     */
    this._levelCollections.get(0)!.primitives.show = true;
  }

  get currentLevel(): number {
    return this._level;
  }

  get renderingTiles(): string[] {
    return Array.from(this._renderingTiles);
  }

  private _addLevel(level: number): void {
    const primitives = new PrimitiveCollection();
    primitives.show = false;
    const tiles = new Map<string, PanoramaTile>();
    const tile = new PanoramaTile(0, 0, level, this._position);
    createTilesForLevel(level, this._position).forEach((tile) => {
      primitives.add(tile.primitive);
      tiles.set(tile.getTileCoordinate().join('/'), tile);
    });
    this._levelCollections.set(level, { primitives, tiles });
    this._primitiveCollection.add(primitives);
  }

  private _cameraChanged(): void {}

  destroy(): void {
    this._primitiveCollection.removeAll();
    this._scene.primitives.remove(this._primitiveCollection);
  }
}
