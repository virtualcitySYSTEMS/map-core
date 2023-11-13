import { check } from '@vcsuite/check';
import type {
  Geometry,
  GeometryCollection,
  Circle,
  SimpleGeometry,
} from 'ol/geom.js';
import type { Extent } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import { VectorHeightInfo } from '../../layer/vectorLayer.js';

class Extent3D {
  static fromArray(
    array: [number, number, number, number, number, number],
  ): Extent3D {
    check(array as [number, number, number, number, number, number], [Number]);
    check(array.length, 6);
    return new Extent3D(
      array[0],
      array[1],
      array[2],
      array[3],
      array[4],
      array[5],
    );
  }

  static fromGeometry(geometry?: Geometry): Extent3D {
    const extent = new Extent3D();
    extent.extendWithGeometry(geometry);
    return extent;
  }

  /**
   * @param  heightInfo
   */
  static fromHeightInfo(heightInfo: VectorHeightInfo): Extent3D {
    const extent = new Extent3D();
    extent.extendWithHeightInfo(heightInfo);
    return extent;
  }

  static fromCoordinates(coordinates: Coordinate[]): Extent3D {
    check(coordinates, [[Number]]);

    const extent = new Extent3D();
    coordinates.forEach((c) => {
      extent.extendXYZ(c[0], c[1], c[2] ?? 0);
    });
    return extent;
  }

  minX: number;

  minY: number;

  minZ: number;

  maxX: number;

  maxY: number;

  maxZ: number;

  constructor(
    minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity,
  ) {
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
  }

  extendWithGeometry(geometry?: Geometry): void {
    if (!geometry) {
      return;
    }
    if (geometry.getType() === 'GeometryCollection') {
      (geometry as GeometryCollection).getGeometriesArray().forEach((geom) => {
        this.extendWithGeometry(geom);
      });
    } else if (geometry.getType() === 'Circle') {
      const flatCoordinates = geometry.getFlatCoordinates();
      const stride = (geometry as Circle).getStride();
      const radius = flatCoordinates[stride] - flatCoordinates[0];
      this.extendXY(flatCoordinates[0] - radius, flatCoordinates[1] - radius);
      this.extendXY(flatCoordinates[0] + radius, flatCoordinates[1] + radius);
      if (stride > 2) {
        this.extendZ(flatCoordinates[2]);
      }
    } else {
      const flatCoordinates = geometry.getFlatCoordinates();
      const stride = (geometry as SimpleGeometry).getStride();
      this.extendFlatCoordinates(flatCoordinates, stride);
    }
  }

  extendWithHeightInfo(heightInfo: VectorHeightInfo): void {
    if (heightInfo.extruded) {
      const calculatedFeatureMaxHeight =
        heightInfo.groundLevel +
        heightInfo.storeyHeightsAboveGround.reduce(
          (accumulator, currentValue) => {
            return accumulator + currentValue;
          },
          0,
        );
      this.extendZ(calculatedFeatureMaxHeight);
      const calculatedFeatureMinHeight =
        heightInfo.groundLevel -
        heightInfo.storeyHeightsBelowGround.reduce(
          (accumulator, currentValue) => {
            return accumulator + currentValue;
          },
          0,
        );
      this.extendZ(calculatedFeatureMinHeight);
    }
  }

  extendXYZ(x: number, y: number, z: number): void {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.minZ = Math.min(this.minZ, z);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.maxZ = Math.max(this.maxZ, z);
  }

  extendXY(x: number, y: number): void {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  extendZ(z: number): void {
    this.minZ = Math.min(this.minZ, z);
    this.maxZ = Math.max(this.maxZ, z);
  }

  extendFlatCoordinates(flatCoordinates: number[], stride: number): void {
    const { length } = flatCoordinates;
    for (let offset = 0; offset < length; offset += stride) {
      if (stride > 2) {
        this.extendXYZ(
          flatCoordinates[offset],
          flatCoordinates[offset + 1],
          flatCoordinates[offset + 2],
        );
      } else {
        this.extendXY(flatCoordinates[offset], flatCoordinates[offset + 1]);
      }
    }
  }

  to2D(): Extent {
    return [this.minX, this.minY, this.maxX, this.maxY];
  }

  toArray(): [number, number, number, number, number, number] {
    return [this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ];
  }

  isEmpty(): boolean {
    return (
      this.minX === Infinity &&
      this.minY === Infinity &&
      this.minZ === Infinity &&
      this.maxX === -Infinity &&
      this.maxY === -Infinity &&
      this.maxZ === -Infinity
    );
  }

  getCenter(): Coordinate {
    if (this.isEmpty()) {
      return [0, 0, 0];
    }
    return [
      this.minX + (this.maxX - this.minX) / 2,
      this.minY + (this.maxY - this.minY) / 2,
      this.minZ + (this.maxZ - this.minZ) / 2,
    ];
  }

  getSize(): [number, number, number] {
    if (this.isEmpty()) {
      return [0, 0, 0];
    }
    return [
      this.maxX - this.minX,
      this.maxY - this.minY,
      this.maxZ - this.minZ,
    ];
  }

  clone(): Extent3D {
    return new Extent3D(
      this.minX,
      this.minY,
      this.minZ,
      this.maxX,
      this.maxY,
      this.maxZ,
    );
  }
}

export default Extent3D;
