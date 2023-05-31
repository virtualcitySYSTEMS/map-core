import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import Viewpoint, { type ViewpointOptions } from './util/viewpoint.js';
import { getObjectFromClassRegistry } from './classRegistry.js';
// eslint-disable-next-line import/no-named-default
import type { default as Layer, LayerOptions } from './layer/layer.js';
// eslint-disable-next-line import/no-named-default
import type { default as VcsMap, VcsMapOptions } from './map/vcsMap.js';
import type {
  // eslint-disable-next-line import/no-named-default
  default as StyleItem,
  StyleItemOptions,
} from './style/styleItem.js';
import type { TileProviderOptions } from './layer/tileProvider/tileProvider.js';
import type { AbstractFeatureProviderOptions } from './featureProvider/abstractFeatureProvider.js';
import type VcsApp from './vcsApp.js';

function getLogger(): Logger {
  return getLoggerByName('init');
}

export type ModuleLayerOptions = LayerOptions & {
  style?: string | StyleItemOptions;
  tileProvider?: TileProviderOptions;
  featureProvider?: AbstractFeatureProviderOptions;
};

export function deserializeMap(
  vcsApp: VcsApp,
  mapConfig: VcsMapOptions,
): VcsMap | null {
  const map = getObjectFromClassRegistry(vcsApp.mapClassRegistry, mapConfig);
  if (map) {
    map.layerCollection = vcsApp.layers;
  }
  return map;
}

export function deserializeViewpoint(
  viewpointObject: ViewpointOptions,
): null | Viewpoint {
  const viewpoint = new Viewpoint(viewpointObject);
  if (viewpoint && viewpoint.isValid()) {
    return viewpoint;
  }
  getLogger().warning(`Viewpoint ${String(viewpointObject.name)} is not valid`);
  return null;
}

export function deserializeLayer(
  vcsApp: VcsApp,
  layerConfig: ModuleLayerOptions,
): Layer | null {
  let style: StyleItem | undefined | null;
  if (layerConfig.style) {
    if (typeof layerConfig.style === 'string') {
      style = vcsApp.styles.getByKey(layerConfig.style);
    } else {
      style = getObjectFromClassRegistry(
        vcsApp.styleClassRegistry,
        layerConfig.style,
      );
    }
  } // TODO highlightStyle

  let tileProvider;
  if (layerConfig.tileProvider) {
    tileProvider = getObjectFromClassRegistry(
      vcsApp.tileProviderClassRegistry,
      layerConfig.tileProvider,
    );
  }

  let featureProvider;
  if (layerConfig.featureProvider) {
    featureProvider = getObjectFromClassRegistry(
      vcsApp.featureProviderClassRegistry,
      layerConfig.featureProvider,
    );
  }

  return getObjectFromClassRegistry(vcsApp.layerClassRegistry, {
    ...layerConfig,
    style,
    tileProvider,
    featureProvider,
  });
}

export function serializeLayer(
  vcsApp: VcsApp,
  layer: Layer,
): ModuleLayerOptions {
  const serializedLayer: ModuleLayerOptions = layer.toJSON();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  serializedLayer.zIndex = layer[vcsApp.layers.zIndexSymbol] as number;
  if (
    (serializedLayer?.style as StyleItemOptions)?.name &&
    vcsApp.styles.hasKey((serializedLayer.style as StyleItemOptions).name)
  ) {
    serializedLayer.style = (serializedLayer.style as StyleItemOptions).name;
  } // TODO highlightStyle
  return serializedLayer;
}

export function getLayerIndex(
  current: Layer,
  previous?: Layer,
  currentIndex?: number,
): number | null | undefined {
  if (current.zIndex !== previous?.zIndex) {
    return null;
  }
  return currentIndex;
}

export function destroyCollection(
  collection: Iterable<{ destroy?: () => void; isDestroyed?: boolean }> & {
    destroy: () => void;
  },
): void {
  [...collection].forEach((i) => {
    if (i.destroy && !i.isDestroyed) {
      i.destroy();
    }
  });
  collection.destroy();
}
