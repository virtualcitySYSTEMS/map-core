import {
  ImageryLayer as CesiumImageryLayer,
  Rectangle,
} from '@vcmap-cesium/engine';
import type { SplitDirection } from '@vcmap-cesium/engine';
import type LayerGroup from 'ol/layer/Group.js';
import type BaseCesiumMap from '../../map/baseCesiumMap.js';
import { wgs84Projection } from '../../util/projection.js';
import { TilingScheme } from '../rasterLayer.js';
import type { LayerImplementationOptions } from '../layer.js';
import TileProvider from '../tileProvider/tileProvider.js';
import MapboxStyleImageryProvider, {
  type MapboxStyleImageryProviderOptions,
} from './mapboxStyleImageryProvider.js';
import RasterLayerCesiumImpl from './rasterLayerCesiumImpl.js';

export type MapboxStyleLayerImplementationOptions =
  LayerImplementationOptions & {
    styledMapboxLayerGroup: LayerGroup;
    splitDirection: SplitDirection;
    minRenderingLevel?: number;
    maxRenderingLevel?: number;
  };

class MapboxStyleCesiumImpl extends RasterLayerCesiumImpl {
  static get className(): string {
    return 'MapboxStyleCesiumImpl';
  }

  private _styledMapboxLayerGroup: LayerGroup;

  minRenderingLevel: number | undefined;

  maxRenderingLevel: number | undefined;

  imageryProvider: MapboxStyleImageryProvider | undefined = undefined;

  constructor(
    map: BaseCesiumMap,
    options: MapboxStyleLayerImplementationOptions,
  ) {
    super(map, {
      ...options,
      minLevel: 0,
      maxLevel: 25,
      tilingSchema: TilingScheme.MERCATOR,
      opacity: 1,
    });
    this._styledMapboxLayerGroup = options.styledMapboxLayerGroup;
    this.minRenderingLevel = options.minRenderingLevel;
    this.maxRenderingLevel = options.maxRenderingLevel;
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active) {
      this._styledMapboxLayerGroup.setVisible(true);
    }
  }

  getCesiumLayer(): Promise<CesiumImageryLayer> {
    const options: MapboxStyleImageryProviderOptions = {
      headers: this.headers,
      styledMapboxLayerGroup: this._styledMapboxLayerGroup,
      minimumTerrainLevel: this.minRenderingLevel,
      maximumTerrainLevel: this.maxRenderingLevel,
      tileProvider: new TileProvider({}),
      tileSize: [256, 256],
    };

    this.imageryProvider = new MapboxStyleImageryProvider(options);

    const layerOptions = this.getCesiumLayerOptions();
    if (this.extent && this.extent.isValid()) {
      const extent = this.extent.getCoordinatesInProjection(wgs84Projection);
      layerOptions.rectangle = Rectangle.fromDegrees(
        extent[0],
        extent[1],
        extent[2],
        extent[3],
      );
    }
    return Promise.resolve(
      // @ts-expect-error mistyped
      new CesiumImageryLayer(this.imageryProvider, layerOptions),
    );
  }

  destroy(): void {
    this.imageryProvider?.destroy();
    super.destroy();
  }
}

export default MapboxStyleCesiumImpl;
