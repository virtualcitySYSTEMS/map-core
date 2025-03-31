import type { VectorOptions } from './vectorLayer.js';
import VectorLayer from './vectorLayer.js';
import { wgs84Projection } from '../util/projection.js';
import { layerClassRegistry } from '../classRegistry.js';
import Extent from '../util/extent.js';
import { getOlFeatures, getValidReader } from './flatGeobufHelpers.js';

export type FlatGeobufLayerOptions = VectorOptions & {
  url: string | Record<string, string>;
};

export default class FlatGeobufLayer extends VectorLayer {
  static get className(): string {
    return 'FlatGeobufLayer';
  }

  static getDefaultOptions(): FlatGeobufLayerOptions {
    return {
      ...super.getDefaultOptions(),
      url: '',
    };
  }

  private _dataFetchedPromise: Promise<void> | undefined;

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await super.initialize();

      if (this._url) {
        await this.fetchData();
      }
    }
  }

  async fetchData(): Promise<void> {
    if (this._dataFetchedPromise) {
      return this._dataFetchedPromise;
    }

    const reader = await getValidReader(this.url, this.projection);
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this._dataFetchedPromise = promise;
    const worldExtent = new Extent({
      coordinates: Extent.WGS_84_EXTENT,
      projection: wgs84Projection.toJSON(),
    });
    const features = await getOlFeatures(reader, this.projection, worldExtent);
    if (this._dataFetchedPromise === promise) {
      this.addFeatures(features);
    }
    resolve!();
    return this._dataFetchedPromise;
  }

  async reload(): Promise<void> {
    if (this._dataFetchedPromise) {
      this._dataFetchedPromise = undefined;
      await this.fetchData();
    }
    return this.forceRedraw();
  }
}
layerClassRegistry.registerClass(FlatGeobufLayer.className, FlatGeobufLayer);
