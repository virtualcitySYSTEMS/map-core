import {
  Cartesian3,
  Color,
  EllipsoidGeometry,
  GeographicTilingScheme,
  Material,
  MaterialAppearance,
  Primitive,
  Math as CesiumMath,
  GeometryInstance,
  HeadingPitchRoll,
  VertexFormat,
  Transforms,
  Cartesian2,
} from '@vcmap-cesium/engine';
import { getNumberOfTiles, tileSizeInRadians } from './panoramaTilingScheme.js';

const tileGapFactor = 0 * CesiumMath.toRadians(0.1);

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

function getTextureClampSource(): string {}

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
}`;

function getDebugTileAppearance(
  x: number,
  y: number,
  level: number,
): MaterialAppearance {
  const canvas = document.createElement('canvas');
  canvas.width = 1028;
  canvas.height = 1028;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(0, 0, 1028, 1028);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, 1028, 1028);

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1); // Flip the context horizontally

  ctx.fillStyle = 'black';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${level}/${x}/${y}`, 1028 / 2, 1028 / 2);

  const [numx, numy] = getNumberOfTiles(level);
  const sizeX = 1 / numx;
  const sizeY = 1 / numy;

  const min = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
  const max = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

  return new MaterialAppearance({
    material: new Material({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image: canvas.toDataURL('image/png'),
          color: Color.HOTPINK.withAlpha(0.8),
          min,
          max,
        },
        source,
      },
    }),
  });
}

function getImageTileAppearance(
  x: number,
  y: number,
  level: number,
): MaterialAppearance {
  const [numx, numy] = getNumberOfTiles(level);
  const sizeX = 1 / numx;
  const sizeY = 1 / numy;

  const min = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
  const max = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

  return new MaterialAppearance({
    material: new Material({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image: `exampleData/pano_000001_000011/${level}/${x}/${y}.jpg`,
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
  x: number,
  y: number,
  level: number,
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
          maximumClock: heading + sizeR + tileGapFactor,
          minimumCone: tilt,
          maximumCone: tilt + sizeR + tileGapFactor,
          stackPartitions: (level + 1) * 64,
          slicePartitions: (level + 1) * 64,
        }),
      }),
    ],
    // appearance: getDebugTileAppearance(x, y, level),
    // appearance: getEmptyTileAppearance(),
    appearance: getImageTileAppearance(x, y, level),
    asynchronous: false,
    modelMatrix: Transforms.headingPitchRollToFixedFrame(
      position,
      new HeadingPitchRoll(0, 0, 0),
    ),
  });
}

export type PanoramaTile = {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly position: Cartesian3;
  readonly primitive: Primitive;
  getTileCoordinate(): [number, number, number];
};

export function createPanoramaTile(
  x: number,
  y: number,
  level: number,
  position: Cartesian3,
): PanoramaTile {
  const primitive = createPrimitive(x, y, level, position);
  // primitive.show = level === 1 && x === 0 && y === 0;

  return {
    get x(): number {
      return x;
    },
    get y(): number {
      return y;
    },
    get level(): number {
      return level;
    },
    get position(): Cartesian3 {
      return position;
    },
    get primitive(): Primitive {
      return primitive;
    },
    getTileCoordinate(): [number, number, number] {
      return [this.x, this.y, this.level];
    },
  };
}

export function createTilesForLevel(
  level: number,
  position: Cartesian3,
): PanoramaTile[] {
  const [maxX, maxY] = getNumberOfTiles(level);

  const tiles: PanoramaTile[] = [];
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      tiles.push(createPanoramaTile(x, y, level, position));
    }
  }

  return tiles;
}
