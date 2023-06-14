import { check } from '@vcsuite/check';
import RasterLayer, {
  RasterLayerImplementationOptions,
  RasterLayerOptions,
} from './rasterLayer.js';
import SingleImageCesiumImpl from './cesium/singleImageCesiumImpl.js';
import SingleImageOpenlayersImpl from './openlayers/singleImageOpenlayersImpl.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenlayersMap from '../map/openlayersMap.js';
import Extent from '../util/extent.js';
import { layerClassRegistry } from '../classRegistry.js';
import { wgs84Projection } from '../util/projection.js';
import VcsMap from '../map/vcsMap.js';

export type SingleImageOptions = RasterLayerOptions & {
  credit?: string;
};

export type SingleImageImplementationOptions =
  RasterLayerImplementationOptions & {
    credit?: string;
  };

/**
 * Image layer for Cesium and OpenlayersMap
 * @group Layer
 */
class SingleImageLayer extends RasterLayer<
  SingleImageCesiumImpl | SingleImageOpenlayersImpl
> {
  static get className(): string {
    return 'SingleImageLayer';
  }

  static getDefaultOptions(): SingleImageOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      credit: undefined,
    };
  }

  credit: string | undefined;

  constructor(options: SingleImageOptions) {
    super(options);
    const defaultOptions = SingleImageLayer.getDefaultOptions();
    this.credit = options.credit || defaultOptions.credit;

    if (!this.extent.isValid()) {
      this.getLogger().warning(
        `layer ${this.name} was constructed with an invalid extent, defaulting to global extent`,
      );
      this.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [-180, -90, 180, 90],
      });
    }

    this._supportedMaps = [CesiumMap.className, OpenlayersMap.className];
  }

  getImplementationOptions(): SingleImageImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      credit: this.credit,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (SingleImageOpenlayersImpl | SingleImageCesiumImpl)[] {
    if (map instanceof CesiumMap) {
      return [new SingleImageCesiumImpl(map, this.getImplementationOptions())];
    } else if (map instanceof OpenlayersMap) {
      return [
        new SingleImageOpenlayersImpl(map, this.getImplementationOptions()),
      ];
    }
    return [];
  }

  /**
   * sets the image extent
   * @param  extent
   */
  setExtent(extent: Extent): void {
    check(extent, Extent);
    if (!extent.isValid()) {
      throw new Error('Cannot set invalid extent');
    }

    this.extent = extent;
    // eslint-disable-next-line no-void
    void this.forceRedraw();
  }

  toJSON(): SingleImageOptions {
    const config: SingleImageOptions = super.toJSON();
    delete config.tilingSchema;

    if (this.credit) {
      config.credit = this.credit;
    }

    return config;
  }
}

layerClassRegistry.registerClass(SingleImageLayer.className, SingleImageLayer);
export default SingleImageLayer;
