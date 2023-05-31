import type { Globe } from '@vcmap-cesium/engine';
import CesiumTilesetCesiumImpl from './cesium/cesiumTilesetCesiumImpl.js';
import CesiumTilesetLayer from './cesiumTilesetLayer.js';
import FeatureStoreLayer from './featureStoreLayer.js';

function waitForImplTilesLoaded(
  impl: CesiumTilesetCesiumImpl,
  timeout?: number,
): Promise<void> {
  return new Promise((resolve) => {
    let timeoutNr: number | undefined | NodeJS.Timeout;
    const remover =
      impl.cesium3DTileset?.allTilesLoaded.addEventListener(() => {
        if (timeoutNr) {
          clearTimeout(timeoutNr);
        }
        remover();
        resolve();
      }) ?? ((): void => {});

    if (timeout != null) {
      timeoutNr = setTimeout(() => {
        remover();
        resolve();
      }, timeout);
    }
  });
}

export async function tiledLayerLoaded(
  layer: CesiumTilesetLayer | FeatureStoreLayer,
  timeout?: number,
): Promise<void> {
  const impls = layer
    .getImplementations()
    .filter(
      (i) => i instanceof CesiumTilesetCesiumImpl,
    ) as CesiumTilesetCesiumImpl[];
  if (!layer.active || impls.every((i) => i.cesium3DTileset?.tilesLoaded)) {
    return;
  }

  await Promise.all(impls.map((i) => waitForImplTilesLoaded(i, timeout)));
}

export function globeLoaded(globe: Globe, timeout?: number): Promise<void> {
  if (globe.tilesLoaded) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeoutNr: number | undefined | NodeJS.Timeout;
    const remover = globe.tileLoadProgressEvent.addEventListener((count) => {
      if (count < 1) {
        if (timeoutNr) {
          clearTimeout(timeoutNr);
        }
        remover();
        resolve();
      }
    });

    if (timeout != null) {
      timeoutNr = setTimeout(() => {
        remover();
        resolve();
      }, timeout);
    }
  });
}
