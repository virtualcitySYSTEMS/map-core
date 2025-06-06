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
import type { TileCoordinate, TileSize } from './panoramaTileCoordinate.js';
import { tileSizeInRadians } from './panoramaTileCoordinate.js';

export type PanoramaTile = {
  readonly primitive: Primitive;
  readonly tileCoordinate: TileCoordinate;
  readonly material: PanoramaTileMaterial;
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
  });
}

/**
 * Creates a panorama tile primitive with the given tile coordinate and image. Typically only called
 * by the PanoramaTileProvider when creating tiles.
 * @param tileCoordinate
 * @param modelMatrix
 * @param tileSize
 */
export function createPanoramaTile(
  tileCoordinate: TileCoordinate,
  modelMatrix: Matrix4,
  tileSize: TileSize,
): PanoramaTile {
  const material = new PanoramaTileMaterial(tileCoordinate, tileSize);
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
    get material(): PanoramaTileMaterial {
      return material;
    },
    destroy(): void {
      primitive.destroy();
      material.destroy();
    },
  };
}
