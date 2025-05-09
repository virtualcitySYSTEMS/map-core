import VectorTileLayer from './vectorTileLayer.js';
import type PanoramaDataset from '../panorama/panoramaDataset.js';

export default class PanoramaDatasetLayer extends VectorTileLayer {
  constructor(dataset: PanoramaDataset) {
    super({ tileProvider: dataset.tileProvider });
  }
}
