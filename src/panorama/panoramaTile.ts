import {
  Cartesian3,
  EllipsoidGeometry,
  GeometryInstance,
  MaterialAppearance,
  Primitive,
  VertexFormat,
  type Matrix4,
} from '@vcmap-cesium/engine';
import type { Size } from 'ol/size.js';
import PanoramaTileMaterial from './panoramaTileMaterial.js';
import type { PanoramaTileCoordinate } from './panoramaTileCoordinate.js';
import { tileSizeInRadians } from './panoramaTileCoordinate.js';
import type PanoramaMap from '../map/panoramaMap.js';
import type {
  PanoramaResourceData,
  PanoramaResourceType,
} from './panoramaTileProvider.js';

export type PanoramaTile = {
  hasResource(type: PanoramaResourceType): boolean;
  setResource<T extends PanoramaResourceType>(
    type: T,
    resource: PanoramaResourceData<T>,
  ): void;
  getDepthAtPixel(x: number, y: number): number | undefined;
  readonly tileCoordinate: PanoramaTileCoordinate;
  getPrimitive(map: PanoramaMap): Primitive;
  getMaterial(map: PanoramaMap): PanoramaTileMaterial | undefined;
  destroy(): void;
};

function createPanoramaTilePrimitive(
  { x, y, level }: PanoramaTileCoordinate,
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
  tileCoordinate: PanoramaTileCoordinate,
  modelMatrix: Matrix4,
  tileSize: Size,
): PanoramaTile {
  let destroyed = false;
  const primitives = new Map<
    PanoramaMap,
    { primitive: Primitive; material: PanoramaTileMaterial }
  >();

  let resources: { [K in PanoramaResourceType]?: PanoramaResourceData<K> } = {};

  return {
    get tileCoordinate(): PanoramaTileCoordinate {
      return tileCoordinate;
    },
    hasResource(type: PanoramaResourceType): boolean {
      return resources[type] != null;
    },
    setResource<T extends PanoramaResourceType>(
      type: T,
      resource: PanoramaResourceData<T>,
    ): void {
      if (this.hasResource(type)) {
        throw new Error(
          `Resource of type "${type}" already set for this tile. Cannot overwrite.`,
        );
      }
      resources[type] = resource as ImageBitmap & Float32Array;
      primitives.forEach(({ material }) => {
        material.setTexture(type, resource);
      });
    },
    getPrimitive(map: PanoramaMap): Primitive {
      if (destroyed) {
        throw new Error('Cannot get primitive from destroyed panorama tile.');
      }
      if (primitives.has(map)) {
        return primitives.get(map)!.primitive;
      }
      const material = new PanoramaTileMaterial(tileCoordinate, tileSize);
      Object.entries(resources).forEach(([type, resource]) => {
        material.setTexture(type as PanoramaResourceType, resource);
      });
      const primitive = createPanoramaTilePrimitive(
        tileCoordinate,
        modelMatrix,
        material,
      );
      primitives.set(map, { primitive, material });
      return primitive;
    },
    getMaterial(map: PanoramaMap): PanoramaTileMaterial | undefined {
      if (primitives.has(map)) {
        return primitives.get(map)!.material;
      }
      return undefined;
    },
    /**
     * Returns the normalized depth value [0, 1] at the given pixel coordinates in the panorama tile.
     * @param x
     * @param y
     */
    getDepthAtPixel(x: number, y: number): number | undefined {
      if (!resources.depth) {
        return undefined;
      }

      const index = y * tileSize[0] + x;
      return resources.depth[index];
    },
    destroy(): void {
      destroyed = true;
      resources = {};
      primitives.forEach(({ primitive, material }) => {
        primitive.destroy();
        material.destroy();
      });
    },
  };
}
