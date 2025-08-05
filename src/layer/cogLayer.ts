import GeoTIFF, { type Options as GeoTIFFOptions } from 'ol/source/GeoTIFF.js';
import type { EventsKey } from 'ol/events.js';
import { unByKey } from 'ol/Observable.js';
import RasterLayer, {
  type RasterLayerImplementationOptions,
  type RasterLayerOptions,
  TilingScheme,
} from './rasterLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';
import COGOpenlayersImpl from './openlayers/cogOpenlayersImpl.js';
import COGCesiumImpl from './cesium/cogCesiumImpl.js';
import Extent from '../util/extent.js';
import { mercatorProjection } from '../util/projection.js';

export type COGLayerOptions = Omit<RasterLayerOptions, 'tilingSchema'> & {
  /**
   * Passed directly to the GeoTIFF source.
   */
  convertToRGB?: boolean | 'auto';
  /**
   * Passed directly to the GeoTIFF source.
   */
  normalize?: boolean;
  /**
   * Passed directly to the GeoTIFF source.
   */
  interpolate?: boolean;
};

export type COGLayerImplementationOptions = RasterLayerImplementationOptions & {
  source: GeoTIFF;
};

function getTilingSchemaFromSource(source: GeoTIFF): Promise<TilingScheme> {
  let key: EventsKey | undefined;
  return new Promise<TilingScheme>((resolve, reject) => {
    const handleChange = (): void => {
      if (source.getState() === 'ready') {
        if (key) {
          unByKey(key);
        }

        const projection = source.getProjection();
        if (!source.getTileGrid()) {
          reject(new Error(`Missing tilegrid in GeoTIFF source not found.`));
        } else if (projection?.getCode() === 'EPSG:4326') {
          resolve(TilingScheme.GEOGRAPHIC);
        } else if (projection?.getCode() === 'EPSG:3857') {
          resolve(TilingScheme.MERCATOR);
        } else {
          reject(new Error(`Unexpected code projection`));
        }
      }
    };

    key = source.on('change', handleChange);
    handleChange();
  });
}

class COGLayer extends RasterLayer<COGOpenlayersImpl | COGCesiumImpl> {
  static get className(): string {
    return 'COGLayer';
  }

  static getDefaultOptions(): COGLayerOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      convertToRGB: 'auto',
      normalize: undefined,
      interpolate: undefined,
    };
  }

  private _sourceOptions: Partial<GeoTIFFOptions>;
  private _source: GeoTIFF | undefined;

  constructor(options: COGLayerOptions) {
    super(options);
    const defaultOptions = COGLayer.getDefaultOptions();
    this._sourceOptions = {
      convertToRGB: options.convertToRGB ?? defaultOptions.convertToRGB,
      normalize: options.normalize,
      interpolate: options.interpolate,
    };

    this._supportedMaps = [OpenlayersMap.className, CesiumMap.className];
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._source = new GeoTIFF({
        ...this._sourceOptions,
        sources: [{ url: this.url }],
      });
      this.tilingSchema = await getTilingSchemaFromSource(this._source);
    }
    return super.initialize();
  }

  getImplementationOptions(): COGLayerImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      source: this._source!,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (COGOpenlayersImpl | COGCesiumImpl)[] {
    if (map instanceof OpenlayersMap) {
      return [new COGOpenlayersImpl(map, this.getImplementationOptions())];
    } else if (map instanceof CesiumMap) {
      return [new COGCesiumImpl(map, this.getImplementationOptions())];
    }

    return [];
  }

  toJSON(): COGLayerOptions {
    const config: Partial<COGLayerOptions> & RasterLayerOptions =
      super.toJSON();
    const defaultOptions = COGLayer.getDefaultOptions();

    delete config.tilingSchema;
    if (this._sourceOptions.convertToRGB !== defaultOptions.convertToRGB) {
      config.convertToRGB = this._sourceOptions.convertToRGB;
    }

    if (this._sourceOptions.normalize != null) {
      config.normalize = this._sourceOptions.normalize;
    }

    if (this._sourceOptions.interpolate != null) {
      config.interpolate = this._sourceOptions.interpolate;
    }

    return config;
  }

  destroy(): void {
    this._source?.dispose();
    super.destroy();
  }

  getZoomToExtent(): Extent | null {
    const extent = this._source?.getTileGrid()?.getExtent();
    if (extent) {
      return new Extent({
        coordinates: extent,
        projection: mercatorProjection.toJSON(),
      });
    }
    return super.getZoomToExtent();
  }
}

layerClassRegistry.registerClass(COGLayer.className, COGLayer);
export default COGLayer;
