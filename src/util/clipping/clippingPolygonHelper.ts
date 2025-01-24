import {
  Cesium3DTileset,
  ClippingPolygon,
  ClippingPolygonCollection,
  Globe,
} from '@vcmap-cesium/engine';
import type CesiumMap from '../../map/cesiumMap.js';
import { vcsLayerName } from '../../layer/layerSymbols.js';

export function getTargetTilesets(
  map: CesiumMap,
  layerNames: string[] | 'all' = 'all',
): Cesium3DTileset[] {
  const tilesets = map
    .getVisualizations()
    .filter((v) => v instanceof Cesium3DTileset);
  if (Array.isArray(layerNames)) {
    return tilesets.filter((v) => layerNames.includes(v[vcsLayerName]));
  }
  return tilesets;
}

export function addClippingPolygon(
  clippee: Globe | Cesium3DTileset,
  polygon: ClippingPolygon | undefined,
): void {
  if (polygon) {
    if (clippee.clippingPolygons === undefined) {
      clippee.clippingPolygons = new ClippingPolygonCollection();
    }
    if (!clippee.clippingPolygons.contains(polygon)) {
      clippee.clippingPolygons.add(polygon);
    }
  }
}

export function removeClippingPolygon(
  clippee: Globe | Cesium3DTileset,
  polygon: ClippingPolygon | undefined,
): void {
  if (
    polygon &&
    clippee.clippingPolygons &&
    clippee.clippingPolygons.contains(polygon)
  ) {
    clippee.clippingPolygons.remove(polygon);
  }
}

export function addClippingPolygonObjectToMap(
  map: CesiumMap,
  polygon: ClippingPolygon | undefined,
  terrain: boolean,
  layerNames: string[] | 'all',
): void {
  if (terrain) {
    const globe = map.getScene()?.globe;
    if (globe) {
      addClippingPolygon(globe, polygon);
    }
  }

  const tilesets = getTargetTilesets(map, layerNames);
  tilesets.forEach((tileset) => {
    addClippingPolygon(tileset, polygon);
  });
}

export function removeClippingPolygonFromMap(
  map: CesiumMap,
  polygon: ClippingPolygon | undefined,
  terrain: boolean,
  layerNames: string[] | 'all',
): void {
  if (terrain) {
    const globe = map.getScene()?.globe;
    if (globe) {
      removeClippingPolygon(globe, polygon);
    }
  }

  const tilesets = getTargetTilesets(map, layerNames);
  tilesets.forEach((tileset) => {
    removeClippingPolygon(tileset, polygon);
  });
}
