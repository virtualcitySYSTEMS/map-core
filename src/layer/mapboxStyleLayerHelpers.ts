import Collection from 'ol/Collection.js';
import type BaseLayer from 'ol/layer/Base.js';
import LayerGroup from 'ol/layer/Group.js';
import { apply } from 'ol-mapbox-style';
import { allowPicking, vcsLayerName } from './layerSymbols.js';

export type StyledMapboxLayerGroupOptions = {
  url: string;
  name: string;
  allowPicking: boolean;
  sources?: string[];
  minRenderingLevel?: number;
  maxRenderingLevel?: number;
};

async function applyStyleAndConfigureGroup(
  mapboxLayerGroup: LayerGroup,
  options: StyledMapboxLayerGroupOptions,
): Promise<void> {
  await apply(mapboxLayerGroup, options.url);

  const layers = mapboxLayerGroup.getLayersArray();
  layers.forEach((layer) => {
    layer[vcsLayerName] = options.name;
    layer[allowPicking] = options.allowPicking;
  });

  if (options.sources && options.sources.length > 0) {
    const filteredCollection = new Collection<BaseLayer>();
    layers
      .filter((layer) =>
        options.sources!.includes(layer.get('mapbox-source') as string),
      )
      .forEach((layer) => {
        filteredCollection.push(layer);
      });

    mapboxLayerGroup.setLayers(filteredCollection);
  }
}

export async function createStyledMapboxLayerGroup(
  options: StyledMapboxLayerGroupOptions,
): Promise<LayerGroup> {
  const mapboxLayerGroup = new LayerGroup({
    minZoom: options.minRenderingLevel,
    maxZoom: options.maxRenderingLevel,
  });

  await applyStyleAndConfigureGroup(mapboxLayerGroup, options);
  return mapboxLayerGroup;
}
