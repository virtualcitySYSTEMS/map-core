import {
  Camera,
  Cartesian2,
  Cartesian3,
  PerspectiveFrustum,
  PrimitiveCollection,
  Scene,
  Math as CesiumMath,
  Transforms,
  HeadingPitchRoll,
  Matrix4,
  Rotation,
  Matrix3,
} from '@vcmap-cesium/engine';
import { Coordinate } from 'ol/coordinate.js';
import { createTilesForLevel, PanoramaTile } from './panoramaTile.js';
import { inverseStereographicProjectionWithTangentPoint } from './stereoGraphicProjection.js';
import {
  cartesianToSpherical,
  sphericalToCartesian,
} from './sphericalCoordinates.js';

type ViewExtent = {
  topLeft: Coordinate;
  topRight: Coordinate;
  bottomLeft: Coordinate;
  bottomRight: Coordinate;
  center: Coordinate;
};

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
): number {
  return 0;
}

function calculateTilesInView(camera: Camera): [number, number, number][] {
  return [];
}

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

function sphericalCameraToSphericalSphere(
  coord: [number, number],
): [number, number] {
  return [
    CesiumMath.convertLongitudeRange(coord[0]) + CesiumMath.PI,
    CesiumMath.PI - (convertLatitudeRange(coord[1]) + CesiumMath.PI_OVER_TWO),
  ];
}

export function calculateView(scene: Scene): undefined | ViewExtent {
  const { camera, canvas } = scene;
  const { height, width } = canvas;
  const lon = camera.heading;
  const lat = camera.pitch;
  const frustum = camera.frustum as PerspectiveFrustum;
  const center = sphericalCameraToSphericalSphere([lon, lat]);
  const cameraDirection = sphericalToCartesian(center);
  const cameraRight = new Cartesian3(Math.cos(lon), Math.sin(lon), 0);
  const up = Cartesian3.cross(cameraDirection, cameraRight, new Cartesian3());

  const { aspectRatio } = frustum;
  let verticalFov;
  let horizontalFov;
  if (width > height) {
    horizontalFov = frustum.fov;
    verticalFov = 2 * Math.atan(Math.tan(horizontalFov / 2) / aspectRatio);
  } else {
    verticalFov = frustum.fov;
    horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspectRatio);
  }

  const halfVerticalFov = verticalFov / 2;
  const halfHorizontalFov = horizontalFov / 2;

  const cameraRotation = Matrix4.inverse(
    Matrix4.fromRotation(
      Matrix3.multiply(
        Matrix3.fromRotationZ(lon),
        Matrix3.fromRotationY(lat),
        new Matrix3(),
      ),
    ),
    new Matrix4(),
  );

  const cartesianOrigin = new Cartesian3(1, 0, 0);

  const rotationPlusVertical = Matrix3.fromRotationY(halfVerticalFov);
  const rotationMinusVertical = Matrix3.fromRotationY(-halfVerticalFov);

  const rotationPlusHorizontal = Matrix3.fromRotationZ(halfHorizontalFov);
  const rotationMinusHorizontal = Matrix3.fromRotationZ(-halfHorizontalFov);

  // Calculate coordinates on the far plane
  const topLeft = Matrix4.multiplyByPoint(
    Matrix4.fromRotation(
      Matrix3.multiply(
        rotationMinusHorizontal,
        rotationPlusVertical,
        new Matrix3(),
      ),
    ),
    cartesianOrigin,
    new Cartesian3(),
  );
  Matrix4.multiplyByPoint(cameraRotation, topLeft, topLeft);
  const topRight = Matrix4.multiplyByPoint(
    Matrix4.fromRotation(rotationPlusVertical),
    cartesianOrigin,
    new Cartesian3(),
  );
  Matrix4.multiplyByPoint(cameraRotation, topRight, topRight);
  const bottomLeft = Matrix4.multiplyByPoint(
    Matrix4.fromRotation(
      Matrix3.multiply(
        rotationMinusHorizontal,
        rotationMinusVertical,
        new Matrix3(),
      ),
    ),
    cartesianCenter,
    new Cartesian3(),
  );
  const bottomRight = Matrix4.multiplyByPoint(
    Matrix4.fromRotation(
      Matrix3.multiply(
        rotationPlusHorizontal,
        rotationMinusVertical,
        new Matrix3(),
      ),
    ),
    cartesianCenter,
    new Cartesian3(),
  );

  console.log('FOV', [horizontalFov, verticalFov].map(CesiumMath.toDegrees));
  console.log('center', center.map(CesiumMath.toDegrees), cartesianCenter);
  console.log(
    'topLeft',
    cartesianToSpherical(topLeft).map(CesiumMath.toDegrees),
  );
  console.log(
    'topRight',
    cartesianToSpherical(topRight).map(CesiumMath.toDegrees),
  );

  return {
    topLeft: cartesianToSpherical(topLeft),
    topRight: cartesianToSpherical(topRight),
    bottomLeft: cartesianToSpherical(bottomLeft),
    bottomRight: cartesianToSpherical(bottomRight),
    center,
  };
}

/*
function unwrapViewCoordinate(
  coordinate: Coordinate,
  worldExtent: [number, number, number, number],
): ViewExtent[] {
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

export function unwrapImageView(extent: ViewExtent): ViewExtent {
  return extent;
}
 */

export function viewApplyToCoordinates(
  extent: ViewExtent,
  callback: (coord: Coordinate) => Coordinate,
  result?: ViewExtent,
): ViewExtent {
  const viewExtent = result ?? structuredClone(extent);
  viewExtent.topLeft = callback(extent.topLeft);
  viewExtent.topRight = callback(extent.topRight);
  viewExtent.bottomLeft = callback(extent.bottomLeft);
  viewExtent.bottomRight = callback(extent.bottomRight);
  viewExtent.center = callback(extent.center);
  return viewExtent;
}

/**
 * converts a view from global [-PI, -PI/2, PI, PI/2] to [0, 0, 2 * PI, PI] and changes the origin from center to top left
 * @param extent
 * @param result
 */
export function viewToImageView(
  extent: ViewExtent,
  _result?: ViewExtent,
): ViewExtent {
  return extent;
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
