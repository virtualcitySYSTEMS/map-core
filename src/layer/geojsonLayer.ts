import type { GeoJSONFeature } from 'ol/format/GeoJSON.js';
import { FeatureCollection } from 'geojson';
import VectorLayer, { VectorOptions } from './vectorLayer.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import Projection, { wgs84Projection } from '../util/projection.js';
import { layerClassRegistry } from '../classRegistry.js';
import { getInitForUrl, requestJson } from '../util/fetch.js';

export type GeoJSONOptions = VectorOptions & {
  features?: GeoJSONFeature[];
};

/**
 * indicates, that this feature is part of the options
 */
export const featureFromOptions = Symbol('featureFromOptions');

/**
 * @group Layer
 */
class GeoJSONLayer extends VectorLayer {
  static get className(): string {
    return 'GeoJSONLayer';
  }

  static getDefaultOptions(): GeoJSONOptions {
    return {
      ...VectorLayer.getDefaultOptions(),
      projection: wgs84Projection.toJSON(),
      features: undefined,
    };
  }

  private _dataFetchedPromise: Promise<void> | null = null;

  private _featuresToLoad: GeoJSONFeature[] | undefined;

  constructor(options: GeoJSONOptions) {
    const defaultOptions = GeoJSONLayer.getDefaultOptions();
    options.projection = options.projection || defaultOptions.projection;

    super(options);
    this._featuresToLoad = options.features || defaultOptions.features;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.fetchData();
    }
    return super.initialize();
  }

  async reload(): Promise<void> {
    if (this._dataFetchedPromise) {
      const configFeatures = this.getFeatures().filter(
        (f) => f[featureFromOptions],
      );
      this.removeAllFeatures();
      this.source.addFeatures(configFeatures);
      this._dataFetchedPromise = null;
      await this.fetchData();
    }
    return super.reload();
  }

  /**
   * Fetches the data for the layer. If data is already fetched returns a resolved Promise
   */
  fetchData(): Promise<void> {
    if (this._dataFetchedPromise) {
      return this._dataFetchedPromise;
    }

    if (Array.isArray(this._featuresToLoad)) {
      this._parseGeojsonData({
        type: 'FeatureCollection',
        features: this._featuresToLoad,
      });

      this.getFeatures().forEach((f) => {
        f[featureFromOptions] = true;
      });

      this._featuresToLoad = undefined;
    }

    if (this.url) {
      const init = getInitForUrl(this.url, this.headers);
      this._dataFetchedPromise = requestJson(this.url, init)
        .then((data) => this._parseGeojsonData(data as FeatureCollection))
        .catch((err) => {
          this.getLogger().warning(
            `Could not send request for loading layer content (${String(err)})`,
          );
          return Promise.reject(err);
        });
    } else {
      this._dataFetchedPromise = Promise.resolve();
    }
    return this._dataFetchedPromise;
  }

  private _parseGeojsonData(obj: GeoJSONFeature | FeatureCollection): void {
    const data = parseGeoJSON(obj, {
      dataProjection: this.projection,
      dynamicStyle: true,
    });
    this.addFeatures(data.features);
    if (data.style) {
      this.setStyle(data.style);
    }
    if (data.vcsMeta) {
      // configured layer vectorProperties trumps vectorProperties from geojson file;
      const meta = { ...data.vcsMeta, ...this.vectorProperties.getVcsMeta() };
      this.setVcsMeta(meta);
    }
  }

  toJSON(): GeoJSONOptions {
    const config: GeoJSONOptions = super.toJSON();
    const defaultOptions = GeoJSONLayer.getDefaultOptions();

    const defaultProjection = new Projection(defaultOptions.projection);
    if (!this.projection.equals(defaultProjection)) {
      config.projection = this.projection.toJSON();
    } else {
      delete config.projection;
    }

    if (Array.isArray(this._featuresToLoad)) {
      config.features = this._featuresToLoad.slice();
    } else {
      const features = this.getFeatures().filter((f) => f[featureFromOptions]);
      if (features.length > 0) {
        config.features = features.map((f) =>
          writeGeoJSONFeature(f, { writeStyle: true, writeId: true }),
        );
      }
    }

    return config;
  }

  destroy(): void {
    super.destroy();
    this._featuresToLoad = [];
  }
}

layerClassRegistry.registerClass(GeoJSONLayer.className, GeoJSONLayer);
export default GeoJSONLayer;
