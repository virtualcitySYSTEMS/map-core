import {
  Camera,
  Cartesian2,
  Cartesian3,
  PerspectiveFrustum,
  PrimitiveCollection,
  Scene,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import { Extent } from 'ol/extent.js';
import { createTilesForLevel, PanoramaTile } from './panoramaTile.js';
import { Coordinate } from 'ol/coordinate.js';

/**
 * idea:
 * - we use a global TMS tiling structure with two level zero tiles.
 * - the image we are trying to render spans the entire globe (in our case sphere)
 * - given a specific tile size, each level has a specific meter per pixel value
 * - given the fov of the camera, we can determine the scene current meters per pixel (if the sphere where the world)
 * - we can determine the current _level_ by using the next best meters per pixel.
 * - we can determine which tiles to load by using the cameras heading & FOV
 */

/**
 * - use haversine distance (or cartesisan distance in 3D space) to determine distance between tile borders
 */

type LevelTiles = {
  primitives: PrimitiveCollection;
  tiles: Map<string, PanoramaTile>;
};

function createTileLevel(level: number, position: Cartesian3): LevelTiles {
  const primitives = new PrimitiveCollection();
  primitives.show = false;
  const tiles = new Map<string, PanoramaTile>();
  // const tile = new PanoramaTile(0, 0, level, this._position);
  createTilesForLevel(level, position).forEach((tile) => {
    primitives.add(tile.primitive);
    tiles.set(tile.getTileCoordinate().join('/'), tile);
  });
  return { primitives, tiles };
}

function calculateDegreesPerPixel(
  camera: Camera,
  windowSize: Cartesian2,
): number {}

function calculateTilesInView(camera: Camera): [number, number, number][] {}

/**
 * Wraps longitude around the globe
 * @param angle
 */
function convertLatitudeRange(angle: number): number {
  const pi = CesiumMath.PI;

  const simplified = angle - Math.floor(angle / pi) * pi;

  if (simplified < -CesiumMath.PI_OVER_TWO) {
    return simplified + pi;
  }
  if (simplified >= CesiumMath.PI_OVER_TWO) {
    return simplified - pi;
  }

  return simplified;
}

function adjustForTilt(coord: [number, number]): [number, number] {
  coord[0] += Math.cos(coord[1]) * (coord[0] - coord[1]);
  return coord;
}

export function calculateView(scene: Scene): Extent {
  const { camera, canvas } = scene;
  const { height, width } = canvas;
  const lon = camera.heading;
  const lat = camera.pitch;

  const frustum = camera.frustum as PerspectiveFrustum;

  const aspectRation = width / height;
  let verticalFov;
  let horizontalFov;
  if (width > height) {
    horizontalFov = frustum.fov;
    verticalFov = 2 * Math.atan(Math.tan(horizontalFov / 2) / aspectRation);
  } else {
    verticalFov = frustum.fov;
    horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspectRation);
  }

  const halfVerticalFov = verticalFov / 2;
  const halfHorizontalFov = horizontalFov / 2;

  const min = [
    CesiumMath.convertLongitudeRange(lon - halfHorizontalFov),
    convertLatitudeRange(lat - halfVerticalFov),
  ];

  const max = [
    CesiumMath.convertLongitudeRange(lon + halfHorizontalFov),
    convertLatitudeRange(lat + halfVerticalFov),
  ];

  return [...adjustForTilt(min), ...adjustForTilt(max)];
}

function unwrapView(extent: Extent, worldExtent: Extent): Extent[] {
  if (extent[0] < extent[2]) {
    if (extent[1] < extent[3]) {
      return [extent];
    }
    return [
      [extent[0], extent[1], extent[2], worldExtent[3]],
      [extent[0], worldExtent[1], extent[2], extent[3]],
    ];
  } else {
    if (extent[1] < extent[3]) {
      return [
        [extent[0], extent[1], worldExtent[2], extent[3]],
        [worldExtent[0], extent[1], extent[2], extent[3]],
      ];
    }
    return [
      [extent[0], extent[1], worldExtent[2], worldExtent[3]],
      [worldExtent[0], worldExtent[1], extent[2], extent[3]],
    ];
  }
}

export function unwrapImageView(extent: Extent): Extent[] {
  return unwrapView(extent, [0, 0, CesiumMath.TWO_PI, CesiumMath.PI]);
}

/**
 * converts a view from global [-PI, -PI/2, PI, PI/2] to [0, 0, 2 * PI, PI] and changes the origin from center to top left
 * @param extent
 */
export function viewToImageView(extent: Extent): Extent {
  return [
    extent[0] + CesiumMath.PI,
    CesiumMath.PI - (extent[3] + CesiumMath.PI_OVER_TWO), // we change the direction of the y-axis, hence max y is now min y and vice versa
    extent[2] + CesiumMath.PI,
    CesiumMath.PI - (extent[1] + CesiumMath.PI_OVER_TWO),
  ];
}

export function createPanoramaImageSource(
  scene: Scene,
  maxLevel: number,
  position: Cartesian3,
): () => void {
  const primitiveCollection = new PrimitiveCollection();

  scene.primitives.add(primitiveCollection); // camera changed listener

  const levelCollections = new Map<number, LevelTiles>();

  for (let i = 0; i <= maxLevel; i++) {
    const tileLevel = createTileLevel(i, position);
    levelCollections.set(i, tileLevel);
    primitiveCollection.add(tileLevel.primitives);
  }

  levelCollections.get(4)!.primitives.show = true;

  return () => {
    primitiveCollection.removeAll();
    scene.primitives.remove(primitiveCollection);
  };
}
