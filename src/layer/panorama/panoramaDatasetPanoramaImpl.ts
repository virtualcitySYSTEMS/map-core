import VectorTilePanoramaImpl from './vectorTilePanoramaImpl.js';
import type { VectorTileImplementationOptions } from '../vectorTileLayer.js';
import type PanoramaMap from '../../map/panoramaMap.js';
import { panoramaFeature } from '../vectorSymbols.js';

export type PanoramaDatasetPanoramaImplOptions =
  VectorTileImplementationOptions & {
    hideInPanorama?: boolean;
  };

export default class PanoramaDatasetPanoramaImpl extends VectorTilePanoramaImpl {
  private _hideInPanorama = false;

  constructor(map: PanoramaMap, options: PanoramaDatasetPanoramaImplOptions) {
    super(map, options);

    this._hideInPanorama = options.hideInPanorama ?? false;

    this.source.on('addfeature', ({ feature }) => {
      const panoramaProps = feature![panoramaFeature]!;
      if (
        panoramaProps.dataset.tileProvider === options.tileProvider &&
        panoramaProps.name === this._currentImage?.name
      ) {
        setTimeout(() => this.source.removeFeature(feature!), 0);
      }
    });
  }

  get hideInPanorama(): boolean {
    return this._hideInPanorama;
  }

  set hideInPanorama(value: boolean) {
    if (this._hideInPanorama !== value) {
      this._hideInPanorama = value;
      if (this._primitiveCollection) {
        this._primitiveCollection.show = !value;
      }
    }
  }

  override async activate(): Promise<void> {
    await super.activate();
    this._primitiveCollection.show = !this.hideInPanorama;
  }
}
