import {
  Cartesian2,
  Cartesian3,
  EllipsoidGeometry,
  GeometryInstance,
  MaterialAppearance,
  Math as CesiumMath,
  Matrix4,
  Primitive,
  VertexFormat,
} from '@vcmap-cesium/engine';
import { Extent } from 'ol/extent.js';
import { cartesian2DDistance } from '../util/math.js';
import PanoramaTileMaterial from './panoramaTileMaterial.js';

/**
 * Tile coordinate in format [x, y, level]
 */
export type TileCoordinate = {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly key: string;
};

export type TileSize = [number, number];

export type PanoramaTile = {
  readonly primitive: Primitive;
  readonly tileCoordinate: TileCoordinate;
  opacity: number;
  destroy(): void;
};

export function createTileCoordinate(
  x: number,
  y: number,
  level: number,
): TileCoordinate {
  return {
    x,
    y,
    level,
    key: `${level}/${x}/${y}`,
  };
}

// let emptyTileAppearance: MaterialAppearance | undefined;
// function getEmptyTileAppearance(): MaterialAppearance {
//   if (!emptyTileAppearance) {
//     emptyTileAppearance = new MaterialAppearance({
//       material: Material.fromType('Color', {
//         color: Color.HOTPINK.withAlpha(0.8),
//       }),
//     });
//   }
//   return emptyTileAppearance;
// }

function addDebugOverlay(
  ctx: CanvasRenderingContext2D,
  tileSize: TileSize,
  text: string,
): void {
  ctx.strokeStyle = 'hotpink';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, tileSize[0], tileSize[1]);

  ctx.translate(tileSize[0], 0);
  ctx.scale(-1, 1); // Flip the context horizontally

  ctx.fillStyle = 'hotpink';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, tileSize[0] / 2, tileSize[1] / 2);
}

export function getNumberOfTiles(level: number): [number, number] {
  const maxX = 2 ** level * 2;
  const maxY = 2 ** level;
  return [maxX, maxY];
}

export function tileSizeInRadians(level: number): number {
  return CesiumMath.PI / 2 ** level;
}

export function tileCoordinateFromImageCoordinate(
  spherical: [number, number],
  level: number,
): TileCoordinate {
  const tileSize = tileSizeInRadians(level);
  const [numTilesX] = getNumberOfTiles(level);
  let tileX = numTilesX - 1 - Math.floor(spherical[0] / tileSize);
  const tileY = Math.floor(spherical[1] / tileSize);
  if (tileX < 0) {
    // wrap around 2 * PI
    tileX = numTilesX + tileX;
  }
  return createTileCoordinate(tileX, tileY, level);
}

export function getTileCoordinatesInImageExtent(
  extent: Extent,
  level: number,
): TileCoordinate[] {
  // the extent is flipped along the X axis, we need to take this into account.
  const bottomLeft = tileCoordinateFromImageCoordinate(
    [extent[2], extent[1]],
    level,
  );
  const topRight = tileCoordinateFromImageCoordinate(
    [extent[0], extent[3]],
    level,
  );

  const numberOfLines = topRight.y - bottomLeft.y;
  const tileCoordinates = new Array<TileCoordinate>(
    (topRight.x - bottomLeft.x) * numberOfLines,
  );
  for (let i = bottomLeft.x; i <= topRight.x; i++) {
    for (let j = bottomLeft.y; j <= topRight.y; j++) {
      tileCoordinates[
        (i - bottomLeft.x) * (numberOfLines + 1) + (j - bottomLeft.y)
      ] = createTileCoordinate(i, j, level);
    }
  }

  return tileCoordinates;
}

export function getTileSphericalCenter(
  tileCoordinate: TileCoordinate,
): [number, number] {
  const sizeR = tileSizeInRadians(tileCoordinate.level);
  const [numTilesX] = getNumberOfTiles(tileCoordinate.level);

  const phi = (numTilesX - 1 - (tileCoordinate.x - 0.5)) * sizeR;
  const theta = (tileCoordinate.y + 0.5) * sizeR;

  return [phi, theta];
}

/**
 * @param tileCoordinate - the tile coordinate to calculate the distance to
 * @param position - the spherical position to calculate the distance from
 * @returns the distance in radians. this is only used for relative comparison.
 */
export function getDistanceToTileCoordinate(
  position: [number, number],
  tileCoordinate: TileCoordinate,
): number {
  const center = getTileSphericalCenter(tileCoordinate);
  const distance = cartesian2DDistance(position, center);

  if (distance > Math.PI) {
    return Math.abs(CesiumMath.TWO_PI - distance);
  }
  return distance;
}

function getImageTileAppearance(
  { x, y, level }: TileCoordinate,
  image: ImageBitmap,
  tileSize: TileSize,
  debug = false,
): MaterialAppearance {
  const [numx, numy] = getNumberOfTiles(level);
  const sizeX = 1 / numx;
  const sizeY = 1 / numy;

  const min = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
  const max = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

  const canvas = document.createElement('canvas'); // XXX offscreen canvas? worker?
  canvas.width = tileSize[0];
  canvas.height = tileSize[1];
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(image, 0, 0, tileSize[0], tileSize[1]);
  if (debug) {
    addDebugOverlay(ctx, tileSize, `${level}/${x}/${y}`);
  }

  const material = new PanoramaTileMaterial(canvas, min, max);

  return new MaterialAppearance({
    material,
    closed: false,
    flat: true,
  });
}

function createPrimitive(
  { x, y, level }: TileCoordinate,
  modelMatrix: Matrix4,
  appearance: MaterialAppearance,
): Primitive {
  const sizeR = tileSizeInRadians(level);
  const heading = x * sizeR;

  const tilt = y * sizeR;
  return new Primitive({
    geometryInstances: [
      new GeometryInstance({
        geometry: new EllipsoidGeometry({
          vertexFormat: VertexFormat.POSITION_AND_ST,
          radii: new Cartesian3(1, 1, 1),
          minimumClock: heading,
          maximumClock: heading + sizeR,
          minimumCone: tilt,
          maximumCone: tilt + sizeR,
          stackPartitions: (level + 1) * 64,
          slicePartitions: (level + 1) * 64,
        }),
      }),
    ],
    appearance,
    asynchronous: true,
    modelMatrix,
  });
}

export function createPanoramaTile(
  tileCoordinate: TileCoordinate,
  image: ImageBitmap,
  modelMatrix: Matrix4,
  tileSize: TileSize,
): PanoramaTile {
  const primitive = createPrimitive(
    tileCoordinate,
    modelMatrix,
    getImageTileAppearance(tileCoordinate, image, tileSize),
  );

  return {
    get primitive(): Primitive {
      return primitive;
    },
    get tileCoordinate(): TileCoordinate {
      return tileCoordinate;
    },
    get opacity(): number {
      return (primitive.appearance.material as PanoramaTileMaterial).opacity;
    },
    set opacity(value: number) {
      (primitive.appearance.material as PanoramaTileMaterial).opacity = value;
    },
    destroy(): void {
      primitive.destroy();
    },
  };
}
