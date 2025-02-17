import {
  Camera,
  Cartesian3,
  Matrix4,
  PrimitiveCollection,
} from '@vcmap-cesium/engine';
import { getWidth } from 'ol/extent.js';
import { getLogger } from '@vcsuite/logger';
import type { PanoramaImage } from './panoramaImage.js';
import {
  createTileCoordinate,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  PanoramaTile,
  TileCoordinate,
  TileSize,
  tileSizeInRadians,
} from './panoramaTile.js';
import { getFovImageSphericalExtent } from './panoramaCameraHelpers.js';
import PanoramaMap from '../map/panoramaMap.js';
import { PanoramaTileProvider } from './panoramaTileProvider.js';

export type PanoramaImageView = {
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  showIntensity: boolean;
  destroy(): void;
  /**
   * force a render of the panorama image
   */
  render(): void;
  getCurrentTiles(): PanoramaTile[];
};

function createMinLevelTiles(minLevel: number): TileCoordinate[] {
  const tiles: TileCoordinate[] = [];
  for (let x = 0; x < 2 ** minLevel * 2; x++) {
    for (let y = 0; y < 2 ** minLevel; y++) {
      tiles.push(createTileCoordinate(x, y, minLevel));
    }
  }
  return tiles;
}

function getLevelPixelPerRadians(level: number, tileSize: TileSize): number {
  return tileSize[0] / tileSizeInRadians(level);
}

function setupImageView(
  image: PanoramaImage,
  primitiveCollection: PrimitiveCollection,
  camera: Camera,
  canvas: HTMLCanvasElement,
): PanoramaImageView {
  const { tileSize, maxLevel, minLevel, hasIntensity } = image;
  const baseTileCoordinates = createMinLevelTiles(minLevel);
  let currentTileCoordinates: TileCoordinate[] = [...baseTileCoordinates];
  const currentTiles = new Map<string, PanoramaTile>();
  const clearCurrentTiles = (): void => {
    currentTiles.forEach((tile) => {
      primitiveCollection.remove(tile.primitive);
    });
    currentTiles.clear();
  };

  let showIntensity = false;
  const tileProviders = new Map<PanoramaTileProvider, () => void>();
  let currentTileProvider: PanoramaTileProvider;

  const setupTileProvider = (tileProvider: PanoramaTileProvider): void => {
    if (!tileProviders.has(tileProvider)) {
      tileProviders.set(
        tileProvider,
        tileProvider.tileLoaded.addEventListener((tile) => {
          if (!currentTiles.has(tile.tileCoordinate.key)) {
            currentTiles.set(tile.tileCoordinate.key, tile);
            if (tile.tileCoordinate.level === minLevel) {
              tile.primitive.modelMatrix = Matrix4.multiplyByScale(
                tile.primitive.modelMatrix,
                new Cartesian3(1.01, 1.01, 1.01),
                new Matrix4(),
              );
            }
            primitiveCollection.add(tile.primitive);
          }
        }),
      );
    }

    if (tileProvider !== currentTileProvider) {
      currentTileProvider = tileProvider;
      clearCurrentTiles();
    }
    tileProvider.loadTiles(currentTileCoordinates);
  };
  setupTileProvider(image.tileProvider);

  camera.setView({
    destination: image.position,
    orientation: {
      heading: 0,
      pitch: 0,
      roll: 0,
    },
  });

  const levelPixelPerRadians = new Array<number>(maxLevel); // XXX can be cached or pre calculated?
  for (let i = 0; i <= maxLevel - minLevel; i++) {
    levelPixelPerRadians[i] = getLevelPixelPerRadians(i + minLevel, tileSize);
  }
  let suspendTileLoading = false;
  const render = (): void => {
    if (suspendTileLoading) {
      return;
    }
    const { extents, center: imageCenter } = getFovImageSphericalExtent(
      camera,
      image,
    );
    const currentImageRadiansWidth = extents.reduce(
      (acc, extent) => acc + getWidth(extent),
      0,
    );
    const currentScenePixelWidth = canvas.width;
    const currentRadiansPerPixel =
      currentScenePixelWidth / currentImageRadiansWidth;
    let currentLevel = minLevel;
    if (currentRadiansPerPixel > levelPixelPerRadians[maxLevel - minLevel]) {
      currentLevel = maxLevel;
    } else if (currentRadiansPerPixel > levelPixelPerRadians[0]) {
      currentLevel =
        levelPixelPerRadians.findIndex((rpp) => rpp >= currentRadiansPerPixel) +
        minLevel;
    }

    if (extents.length === 1) {
      currentTileCoordinates = [
        ...baseTileCoordinates,
        ...getTileCoordinatesInImageExtent(extents[0], currentLevel),
      ];
    } else {
      const leftExtent = extents[0];
      const rightExtent = extents[1];
      leftExtent[2] -= 0.0001; // dont overlap the extents since 0 === 2 * PI
      currentTileCoordinates = [
        ...baseTileCoordinates,
        ...getTileCoordinatesInImageExtent(leftExtent, currentLevel),
        ...getTileCoordinatesInImageExtent(rightExtent, currentLevel),
      ];
    }
    currentTileCoordinates = currentTileCoordinates
      .map((tc) => ({
        tc,
        distance: getDistanceToTileCoordinate(imageCenter, tc),
      }))
      // we sort furthest first, since tiles are loaded from the back of the array with pop.
      .sort((a, b) => b.distance - a.distance)
      .map((tc) => tc.tc);

    currentTiles.forEach((tile) => {
      if (
        !currentTileCoordinates.find((c) => c.key === tile.tileCoordinate.key)
      ) {
        primitiveCollection.remove(tile.primitive);
        currentTiles.delete(tile.tileCoordinate.key);
      }
    });

    currentTileProvider.loadTiles(currentTileCoordinates);
  };
  render();

  return {
    get suspendTileLoading(): boolean {
      return suspendTileLoading;
    },
    set suspendTileLoading(value: boolean) {
      suspendTileLoading = value;
    },
    get showIntensity(): boolean {
      return showIntensity;
    },
    set showIntensity(value: boolean) {
      if (value !== showIntensity) {
        if (value && hasIntensity) {
          showIntensity = value;
          image
            .getIntensityTileProvider()
            .then((intensityTileProvider) => {
              setupTileProvider(intensityTileProvider);
            })
            .catch((e) => {
              console.error(e);
              getLogger('PanoramaImageView').warning('no intensity available');
            });
        } else {
          showIntensity = value;
          setupTileProvider(image.tileProvider);
        }
      }
    },
    getCurrentTiles(): PanoramaTile[] {
      return [...currentTiles.values()];
    },
    render,
    destroy(): void {
      tileProviders.forEach((removeListener) => removeListener());
      tileProviders.clear();
      clearCurrentTiles();
    },
  };
}

export function createPanoramaImageView(map: PanoramaMap): PanoramaImageView {
  const { scene } = map.getCesiumWidget();
  const primitiveCollection = scene.primitives.add(
    new PrimitiveCollection({ destroyPrimitives: false, show: true }),
  ) as PrimitiveCollection;

  const defaultPosition = Cartesian3.fromDegrees(12, 53, 0);

  let currentView: PanoramaImageView | undefined;
  scene.camera.setView({
    destination: defaultPosition,
    orientation: {
      heading: scene.camera.heading ?? 0,
      pitch: 0,
      roll: 0,
    },
  });

  let suspendTileLoading = false;
  let showIntensity = false;

  const setCurrentView = (image?: PanoramaImage): void => {
    const oldView = currentView;
    if (image) {
      currentView = setupImageView(
        image,
        primitiveCollection,
        scene.camera,
        scene.canvas,
      );
      currentView.suspendTileLoading = suspendTileLoading;
      currentView.showIntensity = showIntensity;
    } else {
      currentView = undefined;
    }

    oldView?.destroy();
  };
  setCurrentView(map.currentPanoramaImage);
  const imageChangedListener =
    map.currentImageChanged.addEventListener(setCurrentView);

  const render = (): void => {
    currentView?.render();
  };
  scene.camera.changed.addEventListener(render);
  render();

  return {
    get suspendTileLoading(): boolean {
      return suspendTileLoading;
    },
    set suspendTileLoading(value: boolean) {
      suspendTileLoading = value;
      if (currentView) {
        currentView.suspendTileLoading = value;
      }
    },
    get showIntensity(): boolean {
      return currentView?.showIntensity ?? showIntensity;
    },
    set showIntensity(value: boolean) {
      // XXX ugly
      if (currentView) {
        currentView.showIntensity = value;
        showIntensity = currentView.showIntensity;
      } else {
        showIntensity = value;
      }
    },
    getCurrentTiles(): PanoramaTile[] {
      return currentView?.getCurrentTiles() ?? [];
    },
    render,
    destroy(): void {
      scene.primitives.remove(primitiveCollection);
      primitiveCollection.destroy();
      currentView?.destroy();
      imageChangedListener();
    },
  };
}
