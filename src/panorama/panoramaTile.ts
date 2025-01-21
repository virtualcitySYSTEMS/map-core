import {
  Cartesian2,
  Cartesian3,
  Color,
  EllipsoidGeometry,
  GeometryInstance,
  HeadingPitchRoll,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  Primitive,
  Transforms,
  VertexFormat,
} from '@vcmap-cesium/engine';
import { Extent } from 'ol/extent.js';

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
  readonly position: Cartesian3;
  readonly primitive: Primitive;
  readonly tileCoordinate: TileCoordinate;
  destroy(): void;
};

export function createTileCoordinate(
  x: number,
  y: number,
  level: number,
): TileCoordinate {
  return {
    // XXX Object.freeze to prevent mutability?
    x,
    y,
    level,
    key: `${level}/${x}/${y}`,
  };
}

let emptyTileAppearance: MaterialAppearance | undefined;
function getEmptyTileAppearance(): MaterialAppearance {
  if (!emptyTileAppearance) {
    emptyTileAppearance = new MaterialAppearance({
      material: Material.fromType('Color', {
        color: Color.HOTPINK.withAlpha(0.8),
      }),
    });
  }
  return emptyTileAppearance;
}

// TODO create a default material that can be cached.
const source = `
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material m = czm_getDefaultMaterial(materialInput);
    vec2 clamped = clamp(materialInput.st, min, max);
    vec2 scaled = (clamped - min) / (max - min);
    vec3 t_color = texture(image, scaled).rgb * color.rgb;
    m.diffuse =  t_color;
    m.specular = 0.5;
    m.emission = t_color * vec3(0.5);
    m.alpha = (t_color.rgb == vec3(1.0, 1.0, 1.0)) ? 0.0 : 1.0;
    return m;
}
`;

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
  const tileX = numTilesX - Math.ceil(spherical[0] / tileSize);
  const tileY = Math.floor(spherical[1] / tileSize);

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

  return new MaterialAppearance({
    material: new Material({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image: canvas.toDataURL('image/png'),
          color: Color.WHITE.withAlpha(0.0),
          min,
          max,
        },
        source,
      },
      translucent: false,
    }),
    closed: false,
    flat: true,
  });
}

function createPrimitive(
  { x, y, level }: TileCoordinate,
  position: Cartesian3,
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
    appearance: getEmptyTileAppearance(),
    asynchronous: false,
    modelMatrix: Transforms.headingPitchRollToFixedFrame(
      position,
      new HeadingPitchRoll(0, 0, 0),
    ),
  });
}

export function createPanoramaTile(
  tileCoordinate: TileCoordinate,
  image: ImageBitmap,
  origin: Cartesian3,
  tileSize: TileSize,
): PanoramaTile {
  const primitive = createPrimitive(tileCoordinate, origin);
  // primitive.show = level === 1 && x === 0 && y === 0;
  primitive.appearance = getImageTileAppearance(
    tileCoordinate,
    image,
    tileSize,
    true,
  );

  return {
    get position(): Cartesian3 {
      return origin;
    },
    get primitive(): Primitive {
      return primitive;
    },
    get tileCoordinate(): TileCoordinate {
      return tileCoordinate;
    },
    destroy(): void {
      primitive.destroy();
    },
  };
}
