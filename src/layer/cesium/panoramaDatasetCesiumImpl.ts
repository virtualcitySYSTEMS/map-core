import VectorRasterTileCesiumImpl from './vectorRasterTileCesiumImpl.js';
import PanoramaDatasetImageryProvider from './imageryProvider/panoramaDatasetImageryProvider.js';
import type AbstractVcsImageryProvider from './imageryProvider/abstractVcsImageryProvider.js';

export default class PanoramaDatasetCesiumImpl extends VectorRasterTileCesiumImpl {
  protected _getImageryProvider(): AbstractVcsImageryProvider {
    return new PanoramaDatasetImageryProvider({
      tileProvider: this.tileProvider,
      tileSize: this.tileSize,
      headers: this.headers,
    });
  }
}
