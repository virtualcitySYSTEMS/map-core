import {
  Cartesian3,
  Color,
  EllipsoidGeometry,
  Material,
  MaterialAppearance,
  Primitive,
  GeometryInstance,
  HeadingPitchRoll,
  VertexFormat,
  Transforms,
  Cartesian2,
  GoogleMaps,
} from '@vcmap-cesium/engine';
import { getNumberOfTiles, tileSizeInRadians } from './panoramaTilingScheme.js';
import mapTilesApiEndpoint = module;

/**
 * Tile coordinate in format [x, y, level]
 */
export type TileCoordinate = [number, number, number];

export type PanoramaTile = {
  readonly position: Cartesian3;
  readonly primitive: Primitive;
  readonly key: string;
  getTileCoordinate(): TileCoordinate;
  destroy(): void;
};

export function tileCoordinateToString([x, y, level]: TileCoordinate): string {
  return `${level}/${x}/${y}`;
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
    m.alpha = 1.0;
    return m;
}
`;

function addDebugOverlay(
  ctx: CanvasRenderingContext2D,
  sizeX: number,
  sizeY: number,
  text: string,
): void {
  ctx.strokeStyle = 'hotpink';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, sizeX, sizeY);

  ctx.translate(sizeX, 0);
  ctx.scale(-1, 1); // Flip the context horizontally

  ctx.fillStyle = 'hotpink';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, sizeX / 2, sizeY / 2);
}

function getImageTileAppearance(
  [x, y, level]: TileCoordinate,
  image: ImageBitmap,
  tileSize: [number, number] = [256, 256],
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
    addDebugOverlay(ctx, tileSize[0], tileSize[1], `${level}/${x}/${y}`);
  }

  return new MaterialAppearance({
    material: new Material({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image: canvas.toDataURL('image/png'),
          color: Color.WHITE.withAlpha(1),
          min,
          max,
        },
        source,
      },
    }),
  });
}

function createPrimitive(
  [x, y, level]: TileCoordinate,
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
): PanoramaTile {
  const key = tileCoordinateToString(tileCoordinate);
  const [x, y, level] = tileCoordinate;
  const primitive = createPrimitive(tileCoordinate, origin);
  // primitive.show = level === 1 && x === 0 && y === 0;
  primitive.appearance = getImageTileAppearance(
    tileCoordinate,
    image,
    [256, 256],
    true,
  );

  return {
    get position(): Cartesian3 {
      return origin;
    },
    get primitive(): Primitive {
      return primitive;
    },
    get key(): string {
      return key;
    },
    getTileCoordinate(): TileCoordinate {
      return [x, y, level];
    },
    destroy(): void {
      primitive.destroy();
    },
  };
}
