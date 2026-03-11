import { v4 as uuid } from 'uuid';
import OLMap from 'ol/Map.js';
import type Feature from 'ol/Feature.js';
import type { Coordinate } from 'ol/coordinate.js';
import type LayerGroup from 'ol/layer/Group.js';
import type RenderFeature from 'ol/render/Feature.js';
import { toFeature } from 'ol/render/Feature.js';
import type Layer from '../layer/layer.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from './abstractFeatureProvider.js';
import { isProvidedFeature } from './featureProviderSymbols.js';

export type MapboxFeatureProviderOptions = AbstractFeatureProviderOptions & {
  styledMapboxLayerGroup: LayerGroup;
  excludeLayerFromPicking?: string[];
};

export default class MapboxFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'MapboxFeatureProvider';
  }

  protected _inRenderingOrder = true;

  private _renderMap = new OLMap({ target: document.createElement('div') });
  private _excludeLayerFromPicking?: string[];

  constructor(options: MapboxFeatureProviderOptions) {
    super(options);

    this._renderMap.setSize([256, 256]);
    this._renderMap.addLayer(options.styledMapboxLayerGroup);
    this._excludeLayerFromPicking = options.excludeLayerFromPicking;
  }

  getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
    layer: Layer,
  ): Promise<Feature[]> {
    const view = this._renderMap.getView();
    view.setCenter(coordinate);
    view.setResolution(resolution);

    this._renderMap.renderSync();

    const featuresAtPixel = this._renderMap.getFeaturesAtPixel([
      128, 128,
    ]) as RenderFeature[];
    const features = featuresAtPixel
      .filter((rf) => {
        const layerSource = rf.get('mvt:layer') as string;
        return !this._excludeLayerFromPicking?.includes(layerSource);
      })
      .map((f) => toFeature(f));

    features.forEach((f) => {
      f[vcsLayerName] = layer.name;
      f[isProvidedFeature] = true;
      if (!f.getId()) {
        f.setId(uuid());
      }
    });
    return Promise.resolve(features);
  }

  destroy(): void {
    this._renderMap.setTarget(undefined);
    this._renderMap.dispose();
    super.destroy();
  }
}
