import { Camera, Cartesian2, Matrix4 } from '@vcmap-cesium/engine';
import { Cartesian3 } from '@vcmap-cesium/engine';
import { getWidth } from 'ol/extent.js';
import type { PanoramaImage } from './panoramaImage.js';
import type { PanoramaTile } from './panoramaTile.js';
import {
  getFovImageSphericalExtent,
  windowPositionToImageSpherical,
} from './fieldOfView.js';
import type PanoramaMap from '../map/panoramaMap.js';
import {
  createTileCoordinate,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  TileCoordinate,
  TileSize,
  tileSizeInRadians,
} from './tileCoordinate.js';
import PanoramaTilePrimitiveCollection from './panoramaTilePrimitiveCollection.js';
import { getLogger } from '@vcsuite/logger';
import { imageSphericalToCartesian } from './sphericalCoordinates.js';

const baseLevelScaled = Symbol('baseLevelScaled');
export type PanoramaImageView = {
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  showIntensity: boolean;
  intensityOpacity: number;
  showDepth: boolean;
  showDebug: boolean;
  opacity: number;
  kernelRadius: number;
  cursorRings: number;
  cursorRadius: number;
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

type ImageWrapper = {
  suspendTileLoading: boolean;
  render: () => void;
  destroy: () => void;
};

function setupDepthHandling(
  image: PanoramaImage,
  primitiveCollection: PanoramaTilePrimitiveCollection,
  camera: Camera,
  canvas: HTMLCanvasElement,
): () => void {
  let windowPositon: Cartesian2 | undefined;
  // TODO debounce. check for "enough" changes
  const handlePointerChanged = (x?: number, y?: number): void => {
    if (x != null && y != null) {
      windowPositon = new Cartesian2(x, y);
      const imageSpherical = windowPositionToImageSpherical(
        windowPositon,
        camera,
        image.invModelMatrix,
      );

      if (imageSpherical) {
        image
          .getDepthAtImageCoordinate(imageSpherical)
          .then((depth) => {
            if (depth !== undefined) {
              const imageCartesian = imageSphericalToCartesian(imageSpherical);
              Cartesian3.multiplyByScalar(
                imageCartesian,
                depth / 50,
                imageCartesian,
              );
              primitiveCollection.cursorPosition = imageCartesian;
            } else {
              primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
            }
          })
          .catch(() => {
            getLogger('PanoramaImageView').warning('Failed to get depth');
          });
      } else {
        primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
      }
    } else {
      primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
    }
  };

  const mouseMoveHandler = (event: MouseEvent): void => {
    handlePointerChanged(event.offsetX, event.offsetY);
  };

  const leaveHandler = (): void => {
    handlePointerChanged();
  };

  const touchMoveHandler = (event: TouchEvent): void => {
    const { clientX, clientY } = event.touches[0];
    handlePointerChanged(clientX, clientY);
  };

  canvas.addEventListener('mousemove', mouseMoveHandler);
  canvas.addEventListener('mouseleave', leaveHandler);
  canvas.addEventListener('touchmove', touchMoveHandler);
  canvas.addEventListener('touchend', leaveHandler);

  return (): void => {
    canvas.removeEventListener('mousemove', mouseMoveHandler);
    canvas.removeEventListener('mouseleave', leaveHandler);
    canvas.removeEventListener('touchmove', touchMoveHandler);
    canvas.removeEventListener('touchend', leaveHandler);
  };
}

function createImageWrapper(
  image: PanoramaImage,
  primitiveCollection: PanoramaTilePrimitiveCollection,
  camera: Camera,
  canvas: HTMLCanvasElement,
): ImageWrapper {
  const { tileSize, maxLevel, minLevel, hasDepth } = image;
  const baseTileCoordinates = createMinLevelTiles(minLevel);
  const destroyDepth = hasDepth
    ? setupDepthHandling(image, primitiveCollection, camera, canvas)
    : (): void => {};

  const currentTiles = new Map<string, PanoramaTile>();
  let currentLevel = minLevel;
  let currentTileCoordinates: TileCoordinate[] = [...baseTileCoordinates];

  const createCurrentTiles = (): void => {
    image.tileProvider.currentLevel = currentLevel;
    image.tileProvider
      .createVisibleTiles(currentTileCoordinates)
      .forEach((tile) => {
        if (!currentTiles.has(tile.tileCoordinate.key)) {
          if (
            tile.tileCoordinate.level === minLevel &&
            !(tile as PanoramaTile & { [baseLevelScaled]?: boolean })[
              baseLevelScaled
            ]
          ) {
            tile.primitive.modelMatrix = Matrix4.multiplyByScale(
              tile.primitive.modelMatrix,
              new Cartesian3(1.01, 1.01, 1.01),
              new Matrix4(),
            );
            (tile as PanoramaTile & { [baseLevelScaled]?: boolean })[
              baseLevelScaled
            ] = true;
          }

          currentTiles.set(tile.tileCoordinate.key, tile);
          primitiveCollection.add(tile.primitive);
        }
      });
  };
  const setShowIntensity = (): void => {
    image.tileProvider.showIntensity = primitiveCollection.showIntensity;
  };
  setShowIntensity();
  const showIntensityListener =
    primitiveCollection.showIntensityChanged.addEventListener(setShowIntensity);

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
    currentLevel = minLevel;
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

    createCurrentTiles();
  };
  render();

  return {
    get suspendTileLoading(): boolean {
      return suspendTileLoading;
    },
    set suspendTileLoading(value: boolean) {
      suspendTileLoading = value;
    },
    render,
    destroy(): void {
      currentTiles.forEach((tile) => {
        primitiveCollection.remove(tile.primitive);
      });
      currentTiles.clear();
      showIntensityListener();
      destroyDepth();
    },
  };
}

export function createPanoramaImageView(map: PanoramaMap): PanoramaImageView {
  const { scene } = map.getCesiumWidget();
  const primitiveCollection = scene.primitives.add(
    new PanoramaTilePrimitiveCollection({
      destroyPrimitives: false,
      show: true,
    }),
  ) as PanoramaTilePrimitiveCollection;

  const defaultPosition = Cartesian3.fromDegrees(12, 53, 0);

  let currentView: ImageWrapper | undefined;
  scene.camera.setView({
    destination: defaultPosition,
    orientation: {
      heading: scene.camera.heading ?? 0,
      pitch: 0,
      roll: 0,
    },
  });

  let suspendTileLoading = false;

  const setCurrentView = (image?: PanoramaImage): void => {
    const oldView = currentView;
    if (image) {
      currentView = createImageWrapper(
        image,
        primitiveCollection,
        scene.camera,
        scene.canvas,
      );
      currentView.suspendTileLoading = suspendTileLoading;
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
      return primitiveCollection.showIntensity;
    },
    set showIntensity(value: boolean) {
      primitiveCollection.showIntensity = value;
    },
    get opacity(): number {
      return primitiveCollection.opacity;
    },
    set opacity(value: number) {
      primitiveCollection.opacity = value;
    },
    get intensityOpacity(): number {
      return primitiveCollection.intensityOpacity;
    },
    set intensityOpacity(value: number) {
      primitiveCollection.intensityOpacity = value;
    },
    get showDepth(): boolean {
      return primitiveCollection.showDepth;
    },
    set showDepth(value: boolean) {
      primitiveCollection.showDepth = value;
    },
    get showDebug(): boolean {
      return primitiveCollection.showDebug;
    },
    set showDebug(value: boolean) {
      primitiveCollection.showDebug = value;
    },
    get kernelRadius(): number {
      return primitiveCollection.kernelRadius;
    },
    set kernelRadius(value: number) {
      primitiveCollection.kernelRadius = value;
    },
    get cursorRings(): number {
      return primitiveCollection.cursorRings;
    },
    set cursorRings(value: number) {
      primitiveCollection.cursorRings = value;
    },
    get cursorRadius(): number {
      return primitiveCollection.cursorRadius;
    },
    set cursorRadius(value: number) {
      primitiveCollection.cursorRadius = value;
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
