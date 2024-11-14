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
  const material = new Material({
    fabric: {
      type: 'Image',
      uniforms: {
        image: canvas.toDataURL('image/png'),
      },
      components: {
        diffuse:
          'texture(image, vec2(materialInput.st.x, materialInput.st.y)).rgb',
      },
    },
  });
  return new MaterialAppearance({
    material,
  });
}

function getImageTileAppearance(
  x: number,
  y: number,
  level: number,
): MaterialAppearance {
  const [numx, numy] = getNumberOfTiles(level);
  return new MaterialAppearance({
    material: Material.fromType('Image', {
      image: `exampleData/pano_000001_000011/${level}/${x}/${y}.jpg`,
      repeat: { x: numx, y: numy },
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
          vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
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
    appearance: getDebugTileAppearance(x, y, level),
    // appearance: getEmptyTileAppearance(),
    // appearance: getImageTileAppearance(x, y, level),
    asynchronous: false,
    modelMatrix: Transforms.headingPitchRollToFixedFrame(
      position,
      new HeadingPitchRoll(0, 0, 0),
    ),
  });
}

export default class PanoramaTile {
  private _primitive: Primitive;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly level: number,
    position: Cartesian3,
  ) {
    this._primitive = createPrimitive(x, y, level, position);
  }

  get primitive(): Primitive {
    return this._primitive;
  }

  getTileCoordinate(): [number, number, number] {
    return [this.x, this.y, this.level];
  }
}

export function createTilesForLevel(
  level: number,
  position: Cartesian3,
): PanoramaTile[] {
  const [maxX, maxY] = getNumberOfTiles(level);

  const tiles: PanoramaTile[] = [];
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      tiles.push(new PanoramaTile(x, y, level, position));
    }
  }

  return tiles;
}
