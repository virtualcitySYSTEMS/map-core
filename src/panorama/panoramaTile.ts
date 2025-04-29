import type { Matrix4 } from '@vcmap-cesium/engine';
import {
  Cartesian3,
  EllipsoidGeometry,
  GeometryInstance,
  MaterialAppearance,
  Primitive,
  VertexFormat,
} from '@vcmap-cesium/engine';
import PanoramaTileMaterial from './panoramaTileMaterial.js';
import {
  TileCoordinate,
  TileSize,
  tileSizeInRadians,
} from './tileCoordinate.js';
import type {
  PanoramaResourceData,
  PanoramaResourceType,
} from './panoramaTileProvider.js';

export type PanoramaTile = {
  readonly primitive: Primitive;
  readonly tileCoordinate: TileCoordinate;
  opacity: number;
  showIntensity: boolean;
  setTexture<T extends PanoramaResourceType>(
    type: T,
    data: PanoramaResourceData<T>,
  ): void;
  hasTexture(type: PanoramaResourceType): boolean;
  getDepthAtPixel(x: number, y: number): number | undefined;
  destroy(): void;
};

function createPanoramaTilePrimitive(
  { x, y, level }: TileCoordinate,
  modelMatrix: Matrix4,
  material: PanoramaTileMaterial,
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
    appearance: new MaterialAppearance({
      material,
      closed: false,
      flat: true,
    }),
    modelMatrix,
    asynchronous: level !== 1,
  });
}

/**
 * Creates a panorama tile primitive with the given tile coordinate and image. Typically only called
 * by the PanoramaTileProvider when creating tiles.
 * @param tileCoordinate
 * @param modelMatrix
 */
export function createPanoramaTile(
  tileCoordinate: TileCoordinate,
  modelMatrix: Matrix4,
  tileSize: TileSize,
): PanoramaTile {
  const material = new PanoramaTileMaterial(tileCoordinate);
  const primitive = createPanoramaTilePrimitive(
    tileCoordinate,
    modelMatrix,
    material,
  );

  return {
    get primitive(): Primitive {
      return primitive;
    },
    get tileCoordinate(): TileCoordinate {
      return tileCoordinate;
    },
    get opacity(): number {
      return material.opacity;
    },
    set opacity(value: number) {
      material.opacity = value;
    },
    get showIntensity(): boolean {
      return material.showIntensity;
    },
    set showIntensity(value: boolean) {
      material.showIntensity = value;
    },
    setTexture<T extends PanoramaResourceType>(
      type: T,
      data: PanoramaResourceData<T>,
    ): void {
      material.setTexture(type, data, tileSize);
    },
    hasTexture(type: PanoramaResourceType): boolean {
      return material.hasTexture(type);
    },
    getDepthAtPixel(x: number, y: number): number | undefined {
      return material.getDepthAtPixel(x, y);
    },
    destroy(): void {
      primitive.destroy();
    },
  };
}
