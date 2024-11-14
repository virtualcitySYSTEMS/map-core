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
  Matrix4,
} from '@vcmap-cesium/engine';

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
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, 256, 256);

  ctx.fillStyle = 'black';
  ctx.font = '60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${x}/${y}/${level}`, 128, 128);

  return new MaterialAppearance({
    material: Material.fromType('Image', {
      image: canvas.toDataURL('image/png'),
    }),
  });
}

let tilingScheme: GeographicTilingScheme | undefined;
function getTilingScheme(): GeographicTilingScheme {
  if (!tilingScheme) {
    tilingScheme = new GeographicTilingScheme();
  }
  return tilingScheme;
}

function createPrimitive(
  x: number,
  y: number,
  level: number,
  position: Cartesian3,
): Primitive {
  const tileSizeInDegrees = 180 / 2 ** level;
  const halfSize = tileSizeInDegrees / 2;
  const heading = halfSize + x * tileSizeInDegrees;
  const tilt = halfSize + -90 + y * tileSizeInDegrees;
  console.log(x, y, level);
  console.log(halfSize);
  console.log(heading, tilt);

  return new Primitive({
    geometryInstances: [
      new GeometryInstance({
        geometry: new EllipsoidGeometry({
          vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
          radii: new Cartesian3(1, 1, 1),
          minimumClock: CesiumMath.toRadians(-halfSize),
          maximumClock: CesiumMath.toRadians(halfSize),
          minimumCone: CesiumMath.toRadians(90 - halfSize),
          maximumCone: CesiumMath.toRadians(90 + halfSize),
        }),
      }),
    ],
    appearance: getDebugTileAppearance(x, y, level),
    // appearance: getEmptyTileAppearance(),
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
  const maxX = 2 ** level * 2;
  const maxY = 2 ** level;

  const tiles: PanoramaTile[] = [];
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      tiles.push(new PanoramaTile(x, y, level, position));
    }
  }

  return tiles;
}
