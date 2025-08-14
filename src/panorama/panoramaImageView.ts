import type { Camera, Primitive } from '@vcmap-cesium/engine';
import { Cartesian2, Matrix4, Cartesian3 } from '@vcmap-cesium/engine';
import { getWidth } from 'ol/extent.js';
import type { Size } from 'ol/size.js';
import { getLogger } from '@vcsuite/logger';
import type { PanoramaImage } from './panoramaImage.js';
import type { PanoramaTile } from './panoramaTile.js';
import {
  getFovImageSphericalExtent,
  windowPositionToImageSpherical,
} from './fieldOfView.js';
import type PanoramaMap from '../map/panoramaMap.js';
import type { PanoramaTileCoordinate } from './panoramaTileCoordinate.js';
import {
  createTileCoordinate,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  tileSizeInRadians,
} from './panoramaTileCoordinate.js';
import PanoramaTilePrimitiveCollection from './panoramaTilePrimitiveCollection.js';
import { imageSphericalToCartesian } from './sphericalCoordinates.js';
import { PanoramaOverlayMode } from './panoramaTileMaterial.js';

export type PanoramaImageView = {
  /**
   * Suspends the loading of tiles. This is used as a debug feature.
   */
  suspendTileLoading: boolean;
  /**
   * The primitive collection that contains the panorama tiles.
   */
  readonly tilePrimitiveCollection: PanoramaTilePrimitiveCollection;
  /**
   * Force a render of the panorama image. You do not need to call this for the normal rendering loop.
   */
  render(): void;
  destroy(): void;
};

const baseLevelScaled = Symbol('baseLevelScaled');
const MIN_DEPTH_MOVEMENT_DISTANCE = 5 ** 2; // 5 pixels squared, to avoid too many updates

/**
 * Creates all the tile coordinates for the minimum level of the panorama image.
 * @param minLevel
 */
function createMinLevelTiles(minLevel: number): PanoramaTileCoordinate[] {
  const tiles: PanoramaTileCoordinate[] = [];
  for (let x = 0; x < 2 ** minLevel * 2; x++) {
    for (let y = 0; y < 2 ** minLevel; y++) {
      tiles.push(createTileCoordinate(x, y, minLevel));
    }
  }
  return tiles;
}

/**
 * Calculates the pixel per radians for the given level and tile size.
 * @param level
 * @param tileSize
 */
function getLevelPixelPerRadians(level: number, tileSize: Size): number {
  return tileSize[0] / tileSizeInRadians(level);
}

type ImageWrapper = {
  readonly image: PanoramaImage;
  suspendTileLoading: boolean;
  render(): void;
  destroy(): void;
};

/**
 * Creates an event listener that handles cursor position changes and sets the cursor position in the primitive collection based on depth information from the panorama image.
 * This is set up by the panorama image wrapper, should the image have depth information.
 * @param image
 * @param primitiveCollection
 * @param camera
 * @param canvas
 */
function setupDepthHandling(
  image: PanoramaImage,
  primitiveCollection: PanoramaTilePrimitiveCollection,
  camera: Camera,
  canvas: HTMLCanvasElement,
): () => void {
  let windowPositon: Cartesian2 | undefined;
  const handlePointerChanged = (x?: number, y?: number): void => {
    if (x != null && y != null) {
      const newPosition = new Cartesian2(x, y);
      if (
        windowPositon &&
        Cartesian2.distanceSquared(windowPositon, newPosition) <
          MIN_DEPTH_MOVEMENT_DISTANCE
      ) {
        return;
      }

      windowPositon = newPosition;
      const imageSpherical = windowPositionToImageSpherical(
        windowPositon,
        camera,
        image.invModelMatrix,
      );

      if (imageSpherical) {
        image.tileProvider
          .getDepthAtImageCoordinate(imageSpherical)
          .then((depth) => {
            if (windowPositon !== newPosition) {
              return;
            }

            if (depth !== undefined) {
              const imageCartesian = imageSphericalToCartesian(imageSpherical);
              Cartesian3.multiplyByScalar(
                imageCartesian,
                depth / image.maxDepth,
                imageCartesian,
              );
              primitiveCollection.cursorPosition = imageCartesian;
            } else {
              primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
            }
          })
          .catch(() => {
            getLogger('PanoramaImageView').warning('Failed to get depth');
            primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
          });
      } else {
        primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
      }
    } else {
      primitiveCollection.cursorPosition = new Cartesian3(-1, -1, -1);
      windowPositon = undefined;
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

/**
 * The image wrapper is responsible for managing the panorama image tiles and rendering them.
 */
function createImageWrapper(
  image: PanoramaImage,
  primitiveCollection: PanoramaTilePrimitiveCollection,
  camera: Camera,
  canvas: HTMLCanvasElement,
  map: PanoramaMap,
): ImageWrapper {
  const { tileSize, maxLevel, minLevel, hasDepth } = image;
  const baseTileCoordinates = createMinLevelTiles(minLevel);
  const destroyDepth = hasDepth
    ? setupDepthHandling(image, primitiveCollection, camera, canvas)
    : (): void => {};

  const currentTiles = new Map<string, Primitive>();
  let currentLevel = minLevel;
  let currentTileCoordinates: PanoramaTileCoordinate[] = [
    ...baseTileCoordinates,
  ];

  const createCurrentTiles = (): void => {
    image.tileProvider.currentLevel = currentLevel;
    image.tileProvider
      .createVisibleTiles(currentTileCoordinates)
      .forEach((tile) => {
        if (!currentTiles.has(tile.tileCoordinate.key)) {
          const primitive = tile.getPrimitive(map);
          if (
            tile.tileCoordinate.level === minLevel &&
            !(tile as PanoramaTile & { [baseLevelScaled]?: boolean })[
              baseLevelScaled
            ]
          ) {
            primitive.modelMatrix = Matrix4.multiplyByScale(
              primitive.modelMatrix,
              new Cartesian3(1.01, 1.01, 1.01),
              new Matrix4(),
            );
            (tile as PanoramaTile & { [baseLevelScaled]?: boolean })[
              baseLevelScaled
            ] = true;
          }

          currentTiles.set(tile.tileCoordinate.key, primitive);
          primitiveCollection.add(primitive);
        }
      });
  };

  image.tileProvider.showIntensity =
    primitiveCollection.overlay === PanoramaOverlayMode.Intensity;

  const showIntensityListener =
    primitiveCollection.overlayChanged.addEventListener((overlayMode) => {
      image.tileProvider.showIntensity =
        overlayMode === PanoramaOverlayMode.Intensity;
    });

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

    if (currentLevel === minLevel) {
      currentTileCoordinates = [];
    } else if (extents.length === 1) {
      currentTileCoordinates = [
        ...getTileCoordinatesInImageExtent(extents[0], currentLevel),
      ];
    } else {
      const leftExtent = extents[0];
      const rightExtent = extents[1];
      leftExtent[2] -= 0.0001; // dont overlap the extents since 0 === 2 * PI
      currentTileCoordinates = [
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

    // push base tile coordinates onto the back of the array, so they are always loaded first.
    currentTileCoordinates.push(...baseTileCoordinates);
    currentTiles.forEach((primitive, key) => {
      if (!currentTileCoordinates.find((c) => c.key === key)) {
        primitiveCollection.remove(primitive);
        currentTiles.delete(key);
      }
    });

    createCurrentTiles();
  };
  render();

  return {
    image,
    get suspendTileLoading(): boolean {
      return suspendTileLoading;
    },
    set suspendTileLoading(value: boolean) {
      suspendTileLoading = value;
    },
    render,
    destroy(): void {
      currentTiles.forEach((primitive) => {
        primitiveCollection.remove(primitive);
      });
      currentTiles.clear();
      showIntensityListener();
      destroyDepth();
    },
  };
}

function createEmptyImageBitmap(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.display = 'block';
  overlay.style.top = '0px';
  overlay.style.left = '0px';
  overlay.style.bottom = '0px';
  overlay.style.right = '0px';
  overlay.style.backgroundColor = '#409D76';
  overlay.style.padding = '8px';
  overlay.style.font = 'bold 64px Monospace, Courier New';
  overlay.style.textAlign = 'center';
  overlay.style.alignContent = 'center';
  overlay.style.color = '#424242';
  overlay.innerText = 'No Image';
  return overlay;
}

function setupEmptyImageOverlay(container: HTMLElement): () => void {
  const overlay = createEmptyImageBitmap();
  container.appendChild(overlay);

  let remover: (() => void) | undefined = () => {
    container.removeChild(overlay);
    remover = undefined; // we need to ensure this is only called once
  };

  return () => {
    remover?.();
  };
}

/**
 * The panorama image view is responsible for rendering the current panorama image of a PanoramaMap.
 * It will react to image changes and update the view. It tracks changes
 * to the panorama camera and updates the panorama tiles accordingly. Typically, you will not
 * have to create this directly, but rather use the PanoramaMap's imageView property.
 * @param map
 */
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
  let removeOverlay: (() => void) | undefined;
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
    removeOverlay?.();
    if (image) {
      currentView = createImageWrapper(
        image,
        primitiveCollection,
        scene.camera,
        scene.canvas,
        map,
      );
      currentView.suspendTileLoading = suspendTileLoading;
    } else {
      currentView = undefined;
      if (scene.canvas.parentElement) {
        removeOverlay = setupEmptyImageOverlay(scene.canvas.parentElement);
      }
    }

    oldView?.destroy();
  };
  setCurrentView(map.currentPanoramaImage);

  const imageChangedListener =
    map.currentImageChanged.addEventListener(setCurrentView);

  const render = (): void => {
    currentView?.render();
  };
  const cameraChangedListener = scene.camera.changed.addEventListener(render);
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
    get tilePrimitiveCollection(): PanoramaTilePrimitiveCollection {
      return primitiveCollection;
    },
    render,
    destroy(): void {
      this.render = (): void => {};
      scene.primitives.remove(primitiveCollection);
      currentView?.destroy();
      imageChangedListener();
      cameraChangedListener();
      removeOverlay?.();
    },
  };
}
