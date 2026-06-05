import { type Extent as OLExtent } from 'ol/extent.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import { type VectorTileImageryProviderOptions } from './vectorTileImageryProvider.js';
import {
  createOLImageRenderer,
  type OLImageRenderer,
} from './olImageRenderer.js';
import Extent from '../../../util/extent.js';
import { mercatorProjection } from '../../../util/projection.js';
import AbstractVcsImageryProvider from './abstractVcsImageryProvider.js';
import type TileProvider from '../../tileProvider/tileProvider.js';

export default class PanoramaDatasetImageryProvider extends AbstractVcsImageryProvider {
  private _source = new VectorSource({ useSpatialIndex: false });

  private _olImageRenderer: OLImageRenderer;

  tileProvider: TileProvider;

  constructor(options: VectorTileImageryProviderOptions) {
    super({
      tilingScheme: options.tileProvider.tilingScheme,
      tileSize: options.tileSize,
      minLevel: 0,
      maxLevel: 26,
    });

    this.tileProvider = options.tileProvider;

    this._olImageRenderer = createOLImageRenderer({
      tilingScheme: this.tileProvider.tilingScheme,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
      emptyCanvas: this.emptyCanvas,
      fetchFeatures: this._fetchFeatures.bind(this),
    });
    this._olImageRenderer.map.addLayer(
      new VectorLayer({ source: this._source, declutter: true }),
    );
  }

  requestImage(
    x: number,
    y: number,
    level: number,
  ): Promise<HTMLImageElement | HTMLCanvasElement> | undefined {
    return this._olImageRenderer.requestImage(x, y, level);
  }

  private async _fetchFeatures(
    _x: number,
    _y: number,
    level: number,
    extent: OLExtent,
  ): Promise<void> {
    const vcsExtent = new Extent({
      coordinates: extent,
      projection: mercatorProjection.toJSON(),
    });
    const features = await this.tileProvider.getFeaturesForExtent(
      vcsExtent,
      level,
    );
    this._source.clear(true);
    this._source.addFeatures(features);
  }

  destroy(): void {
    this._source.dispose();
    this._olImageRenderer.destroy();
  }
}
