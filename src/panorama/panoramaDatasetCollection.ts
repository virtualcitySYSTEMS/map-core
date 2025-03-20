import { getLogger } from '@vcsuite/logger';
import { WebMercatorTilingScheme } from '@vcmap-cesium/engine';
import { Coordinate } from 'ol/coordinate.js';
import Collection from '../util/collection.js';
import PanoramaDataset from './panoramaDataset.js';
import { TileCoordinate } from './panoramaTile.js';
import { PanoramaImage } from './panoramaImage.js';

export default class PanoramaDatasetCollection extends Collection<PanoramaDataset> {
  static get className(): string {
    return 'PanoramaDatasetCollection';
  }

  readonly tilingScheme = new WebMercatorTilingScheme();

  private _currentTile: TileCoordinate | undefined;

  private _datasetListeners = new Map<PanoramaDataset, () => void>();

  constructor() {
    super();

    this.added.addEventListener((dataset) => {
      this._datasetListeners.set(
        dataset,
        dataset.stateChanged.addEventListener(() => {
          if (dataset.active) {
            this._loadDatasetSync(dataset);
          }
        }),
      );
      if (dataset.active) {
        this._loadDatasetSync(dataset);
      }
    });

    this.removed.addEventListener((dataset) => {
      const listener = this._datasetListeners.get(dataset);
      if (listener) {
        listener();
        this._datasetListeners.delete(dataset);
      }
    });
  }

  private async _loadDataset(
    dataset: PanoramaDataset,
    tile = this._currentTile,
  ): Promise<void> {
    if (tile) {
      await dataset.tileProvider.getFeaturesForTile(tile.x, tile.y, tile.level);
    }
  }

  private _loadDatasetSync(
    dataset: PanoramaDataset,
    tile = this._currentTile,
  ): void {
    this._loadDataset(dataset, tile).catch((error) => {
      getLogger('PanoramaDatasetCollection').error(
        `Error loading dataset ${dataset.name} at tile ${
          tile?.key ?? 'undefined'
        }`,
        error,
      );
    });
  }

  async getClosestImage(
    coordinate: Coordinate,
    maxDistance?: number,
  ): Promise<PanoramaImage | undefined> {
    const loadPromises = this._array
      .filter((dataset) => dataset.active)
      .map(async (dataset) => dataset.getClosestImage(coordinate, maxDistance));

    await Promise.all(loadPromises);

    // XXX acutally determine closest one
    return loadPromises[0];
  }

  destroy(): void {
    this._datasetListeners.forEach((listener) => {
      listener();
    });
    this._datasetListeners.clear();
    super.destroy();
  }
}
