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
} from '@vcmap-cesium/engine';
import { getNumberOfTiles, tileSizeInRadians } from './panoramaTilingScheme.js';

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

// create a default material that can be cached.
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

async function addDebugOverlay(
  src: string,
  sizeX: number,
  sizeY: number,
  text: string,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = sizeX;
  canvas.height = sizeY;
  const ctx = canvas.getContext('2d')!;

  const img = new Image();
  img.src = src;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  ctx.drawImage(img, 0, 0, sizeX, sizeY);

  ctx.strokeStyle = 'hotpink';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, sizeX, sizeY);

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1); // Flip the context horizontally

  ctx.fillStyle = 'hotpink';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, sizeX / 2, sizeY / 2);

  return canvas.toDataURL('image/png');
}

async function getImageTileAppearance(
  x: number,
  y: number,
  level: number,
  debug?: boolean,
): Promise<MaterialAppearance> {
  const [numx, numy] = getNumberOfTiles(level);
  const sizeX = 1 / numx;
  const sizeY = 1 / numy;

  const min = new Cartesian2(x * sizeX, 1 - (y * sizeY + sizeY));
  const max = new Cartesian2(x * sizeX + sizeX, 1 - y * sizeY);

  let image = `exampleData/pano_000001_000011/${level}/${x}/${y}.jpg`;
  if (debug) {
    image = await addDebugOverlay(image, 256, 256, `${level}/${x}/${y}`);
  }

  return new MaterialAppearance({
    material: new Material({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image,
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

export type PanoramaTile = {
  readonly x: number;
  readonly y: number;
  readonly level: number;
  readonly position: Cartesian3;
  readonly primitive: Primitive;
  readonly readyPromise: Promise<void>;
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
  const readyPromise = getImageTileAppearance(x, y, level, true)
    .then((appearance) => {
      primitive.appearance = appearance;
    })
    .catch((_e) => {
      console.error('Failed to load image');
    });

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
    get readyPromise(): Promise<void> {
      return readyPromise;
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
