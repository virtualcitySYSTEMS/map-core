import type { Coordinate } from 'ol/coordinate.js';
import { Cartesian3, Cartesian4, Matrix3, Matrix4 } from '@vcmap-cesium/engine';
import { transformCWIFC } from './helpers.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import type { ObliqueViewDirection } from './obliqueViewDirection.js';
import type ObliqueImageMeta from './obliqueImageMeta.js';

export const isDefaultImageSymbol = Symbol('isDefaultImage');

export type ObliqueImageOptions = {
  name: string;
  viewDirection: ObliqueViewDirection;
  viewDirectionAngle?: number;
  groundCoordinates: Coordinate[];
  centerPointOnGround: Coordinate;
  meta: ObliqueImageMeta;
  projectionCenter?: Cartesian3;
  pToRealworld?: Matrix3;
  pToImage?: Matrix4;
};

class ObliqueImage {
  /**
   * Name of the image
   */
  name: string;

  /**
   * Meta information shared across multiple images.
   */
  meta: ObliqueImageMeta;

  /**
   * viewDirection
   */
  viewDirection: ObliqueViewDirection;

  /**
   * viewDirectionAngle in radians, where 0 = east, PI / 2 = north, PI = west and PI * 1.5 = south
   */
  viewDirectionAngle: number | undefined;

  /**
   * The ground coordinates of the image corners (in image world projection).
   */
  groundCoordinates: Array<Coordinate>;

  /**
   * The center point of the image in world coordinates (in image world projection).
   */
  centerPointOnGround: Coordinate;

  /**
   * The transformation matrix image to real world (in image world projection).
   */
  pToRealworld: Matrix3 | null;

  /**
   * The transformation matrix real to image (in image world projection).
   */
  pToImage: Matrix4 | null;

  /**
   * The projection center in image world projection
   */
  projectionCenter: Cartesian3 | null;

  /**
   * The calculated average height of an image
   */
  private _averageHeight: number | null;

  [isDefaultImageSymbol]?: boolean;

  constructor(options: ObliqueImageOptions) {
    this.name = options.name;
    this.meta = options.meta;
    this.viewDirection = options.viewDirection;
    this.viewDirectionAngle = options.viewDirectionAngle;
    this.groundCoordinates = options.groundCoordinates;
    this.centerPointOnGround = options.centerPointOnGround;
    this.pToRealworld = options.pToRealworld || null;
    this.pToImage = options.pToImage || null;
    this.projectionCenter = options.projectionCenter || null;
    this._averageHeight = null;
  }

  /**
   * returns the averageHeight of the image or 0 if not defined. Be sure to call calculateAverageHeight before hand.
   */
  get averageHeight(): number {
    return this._averageHeight != null ? this._averageHeight : 0;
  }

  /**
   * returns whether this image supports exact Coordinate transformation
   */
  get hasCamera(): boolean {
    return !!this.meta.principalPoint;
  }

  /**
   * @param  imageCoordinate
   * @param  optAvgHeight
   */
  transformImage2RealWorld(
    imageCoordinate: Coordinate,
    optAvgHeight?: number,
  ): Coordinate {
    let distortedCoordinate = imageCoordinate;
    if (!this.meta.principalPoint) {
      return this._transformNoCamera(distortedCoordinate, true, optAvgHeight);
    } else if (this.meta.hasRadial) {
      distortedCoordinate = this.meta.radialDistortionCoordinate(
        distortedCoordinate,
        true,
      );
    }

    const x = new Cartesian3(
      distortedCoordinate[0],
      this.meta.size[1] - distortedCoordinate[1],
      1,
    );
    const rayWorld = Matrix3.multiplyByVector(
      this.pToRealworld as Matrix3,
      x,
      new Cartesian3(),
    );
    const avgHeight = optAvgHeight || this.averageHeight;
    const centerPointOnGround = new Cartesian3(
      this.centerPointOnGround[0],
      this.centerPointOnGround[1],
      avgHeight,
    );
    const w0 = Cartesian3.subtract(
      this.projectionCenter as Cartesian3,
      centerPointOnGround,
      new Cartesian3(),
    );
    const a = Cartesian3.dot(Cartesian3.UNIT_Z, w0) * -1;
    const b = Cartesian3.dot(Cartesian3.UNIT_Z, rayWorld);

    const r = a / b;

    const intr = Cartesian3.add(
      this.projectionCenter as Cartesian3,
      Cartesian3.multiplyByScalar(rayWorld, r, new Cartesian3()),
      new Cartesian3(),
    );
    return [intr.x, intr.y, avgHeight];
  }

  transformRealWorld2Image(
    worldCoordinate: Coordinate,
    optAvgHeight?: number,
  ): Coordinate {
    // if we dont have camera parameters
    if (!this.meta.principalPoint) {
      return this._transformNoCamera(worldCoordinate, false, optAvgHeight);
    }

    // usage of perspective projection
    // the averaged height is used for projection so far
    const avgHeight = optAvgHeight || this.averageHeight;

    const P = new Cartesian4(
      worldCoordinate[0],
      worldCoordinate[1],
      avgHeight,
      1,
    );

    const camSys = Matrix4.multiplyByVector(
      this.pToImage as Matrix4,
      P,
      new Cartesian4(),
    );
    const respectiveImageCoords = [camSys.x / camSys.z, camSys.y / camSys.z];
    // adjust to ol image coordinates
    const imCoords = [
      respectiveImageCoords[0],
      this.meta.size[1] - respectiveImageCoords[1],
    ];

    return this.meta.radialDistortionCoordinate(imCoords, false);
  }

  private _transformNoCamera(
    coord: Coordinate,
    isImage: boolean,
    optAvgHeight?: number,
  ): Coordinate {
    const imageCoords = [
      [0, 0],
      [this.meta.size[0], 0],
      this.meta.size,
      [0, this.meta.size[1]],
    ];
    const intrCross = transformCWIFC(
      isImage ? imageCoords : this.groundCoordinates,
      isImage ? this.groundCoordinates : imageCoords,
      isImage,
      coord,
      this.viewDirection,
    );
    const height = optAvgHeight || this.averageHeight;
    // if intersection could not be determined write error and return center
    if (intrCross === null || intrCross.x == null || intrCross.y == null) {
      // eslint-disable-next-line no-console
      console.error(
        'Real world coordinate could not be determined from footprint data, center will be returned',
      );
      const coords = [this.centerPointOnGround[0], this.centerPointOnGround[1]];
      if (isImage) {
        coords.push(height);
      }
      return coords;
    }
    const coords = [intrCross.x, intrCross.y];
    if (isImage) {
      coords.push(height);
    }
    return coords;
  }

  /**
   * calculates the averageHeight of this image, if a terrainProvider is given the height will be requested
   */
  calculateImageAverageHeight(): Promise<void> {
    if (this._averageHeight === null) {
      const averageHeight =
        (this.groundCoordinates[0][2] +
          this.groundCoordinates[1][2] +
          this.groundCoordinates[2][2] +
          this.groundCoordinates[3][2]) /
        4;
      if (averageHeight === 0 && this.meta.terrainProvider) {
        return getHeightFromTerrainProvider(
          this.meta.terrainProvider,
          [this.centerPointOnGround.slice()],
          this.meta.projection,
        )
          .then((coords) => {
            if (coords[0] && coords[0][2] != null) {
              this._averageHeight = coords[0][2];
            }
          })
          .catch(() => {
            this._averageHeight = averageHeight;
          });
      }
      this._averageHeight = averageHeight;
    }
    return Promise.resolve();
  }
}

export default ObliqueImage;
