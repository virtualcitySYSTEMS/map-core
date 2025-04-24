import type { Camera } from '@vcmap-cesium/engine';
import { Cartesian3, Matrix4, PrimitiveCollection } from '@vcmap-cesium/engine';
import { getWidth } from 'ol/extent.js';
import { getLogger } from '@vcsuite/logger';
import type { PanoramaImage } from './panoramaImage.js';
import type { PanoramaTile, TileCoordinate, TileSize } from './panoramaTile.js';
import {
  createTileCoordinate,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  tileSizeInRadians,
} from './panoramaTile.js';
import { getFovImageSphericalExtent } from './fieldOfView.js';
import type PanoramaMap from '../map/panoramaMap.js';
import type { PanoramaTileProvider } from './panoramaTileProvider.js';

export type PanoramaImageView = {
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  showIntensity: boolean;
  intensityOpacity: number;
  opacity: number;
  destroy(): void;
  /**
   * force a render of the panorama image
   */
  render(): void;
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

type PanoramaTileProviderView = {
  opacity: number;
  disabled: boolean;
  clearCurrentTiles(): void;
  update(currentTileCoordinates: TileCoordinate[]): void;
  destroy(): void;
};

function setupPanoramaTileProviderView(
  tileProvider: PanoramaTileProvider,
  primitiveCollection: PrimitiveCollection,
  minLevel: number,
): PanoramaTileProviderView {
  const currentTiles = new Map<string, PanoramaTile>();
  let opacity = 1;
  let disabled = false;
  let currentTileCoordinates: TileCoordinate[] = [];

  const tileLoadedEvent = tileProvider.tileLoaded.addEventListener((tile) => {
    if (disabled) {
      return;
    }
    tile.opacity = opacity;
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
  });

  const clearCurrentTiles = (): void => {
    currentTiles.forEach((tile) => {
      primitiveCollection.remove(tile.primitive);
    });
    currentTiles.clear();
  };

  return {
    get opacity(): number {
      return opacity;
    },
    set opacity(value: number) {
      opacity = value;
      currentTiles.forEach((tile) => {
        tile.opacity = value;
      });
    },
    get disabled(): boolean {
      return disabled;
    },
    set disabled(value: boolean) {
      disabled = value;
      if (disabled) {
        clearCurrentTiles();
        tileProvider.setVisibleTiles([]);
      } else {
        tileProvider.setVisibleTiles(currentTileCoordinates);
      }
    },
    clearCurrentTiles,
    update(newCurrentTileCoordinates: TileCoordinate[]): void {
      currentTileCoordinates = newCurrentTileCoordinates;
      if (disabled) {
        return;
      }
      currentTiles.forEach((tile) => {
        if (
          !currentTileCoordinates.find((c) => c.key === tile.tileCoordinate.key)
        ) {
          primitiveCollection.remove(tile.primitive);
          currentTiles.delete(tile.tileCoordinate.key);
        }
      });
      tileProvider.setVisibleTiles(currentTileCoordinates);
    },
    destroy(): void {
      tileLoadedEvent();
    },
  };
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

  let showIntensity = false;
  const rgbTileProviderView = setupPanoramaTileProviderView(
    image.tileProvider,
    primitiveCollection,
    minLevel,
  );
  let intensityTileProviderView: PanoramaTileProviderView | undefined;

  camera.setView({
    destination: image.position,
    orientation: {
      heading: camera.heading,
      pitch: image.orientation.pitch,
      roll: image.orientation.roll,
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
      image.invModelMatrix,
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

    rgbTileProviderView.update(currentTileCoordinates);
    intensityTileProviderView?.update(currentTileCoordinates);
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
          if (!intensityTileProviderView) {
            image
              .getIntensityTileProvider()
              .then((intensityTileProvider) => {
                intensityTileProviderView = setupPanoramaTileProviderView(
                  intensityTileProvider,
                  primitiveCollection,
                  minLevel,
                );
                if (showIntensity) {
                  intensityTileProviderView.update(currentTileCoordinates);
                }
              })
              .catch((e: unknown) => {
                getLogger('PanoramaImageView').error(String(e));
                getLogger('PanoramaImageView').warning(
                  'no intensity available',
                );
              });
          } else {
            intensityTileProviderView.disabled = false;
          }
        } else {
          showIntensity = value;
          if (intensityTileProviderView) {
            intensityTileProviderView.disabled = true;
          }
        }
      }
    },
    get opacity(): number {
      return rgbTileProviderView.opacity;
    },
    set opacity(value: number) {
      rgbTileProviderView.opacity = value;
    },
    render,
    destroy(): void {
      rgbTileProviderView.destroy();
      intensityTileProviderView?.destroy();
    },
    get intensityOpacity(): number {
      return intensityTileProviderView?.opacity ?? 1;
    },
    set intensityOpacity(value: number) {
      if (intensityTileProviderView) {
        intensityTileProviderView.opacity = value;
      }
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
        ({ showIntensity } = currentView);
      } else {
        showIntensity = value;
      }
    },
    get opacity(): number {
      return currentView?.opacity ?? 1;
    },
    set opacity(value: number) {
      if (currentView) {
        currentView.opacity = value;
      }
    },
    render,
    destroy(): void {
      scene.primitives.remove(primitiveCollection);
      primitiveCollection.destroy();
      currentView?.destroy();
      imageChangedListener();
    },
    get intensityOpacity(): number {
      return currentView?.intensityOpacity ?? 1;
    },
    set intensityOpacity(value: number) {
      if (currentView) {
        currentView.intensityOpacity = value;
      }
    },
  };
}
