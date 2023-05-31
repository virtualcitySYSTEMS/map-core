import type { Size } from 'ol/size.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import { cartesian2DDistance } from '../util/math.js';
import type Projection from '../util/projection.js';

export type ObliqueImageMetaOptions = {
  'principal-point'?: Coordinate;
  'pixel-size'?: Coordinate;
  'radial-distorsion-expected-2-found'?: number[];
  'radial-distorsion-found-2-expected'?: number[];
  size: Size;
  tileSize: Size;
  tileResolution: number[];
  projection: Projection;
  url: string;
  terrainProvider?: CesiumTerrainProvider;
  name: string;
  format?: string;
};

class ObliqueImageMeta {
  /**
   * The name of the camera associated with these meta data
   */
  readonly name: string;

  principalPoint: Coordinate | undefined;

  pixelSize: Coordinate | undefined;

  radialE2F: Array<number> | undefined;

  radialF2E: Array<number> | undefined;

  hasRadial: boolean;

  /**
   * The size of the images associated with this meta data
   */
  size: Size;

  /**
   * The tile size of the images associated with this meta data
   */
  tileSize: Size;

  /**
   * The tile resolutions of the images associated with this meta data
   */
  tileResolution: Array<number>;

  /**
   * The world projection of the images associated with this meta
   */
  projection: Projection;

  url: string;

  /**
   * An optional terrain provider
   */
  terrainProvider: CesiumTerrainProvider | undefined;

  format: string;

  constructor(options: ObliqueImageMetaOptions) {
    this.name = options.name;
    this.principalPoint = options['principal-point'];
    this.pixelSize = options['pixel-size'];
    this.radialE2F = options['radial-distorsion-expected-2-found'];
    this.radialF2E = options['radial-distorsion-found-2-expected'];
    this.hasRadial = !!(this.pixelSize && this.radialE2F && this.radialF2E);
    this.size = options.size;
    this.tileSize = options.tileSize;
    this.tileResolution = options.tileResolution;
    this.projection = options.projection;
    this.url = options.url;
    this.terrainProvider = options.terrainProvider;
    this.format = options.format || 'jpg';
  }

  /**
   * Removes radial distortion in image coordinates. Radial coefficients must be provided
   * @param  coordinate
   * @param  [useF2E=false] useFound2Expected, if not true expectedToFound is used
   */
  radialDistortionCoordinate(
    coordinate: Coordinate,
    useF2E: unknown,
  ): Coordinate {
    if (this.hasRadial && this.principalPoint) {
      const coefficientsArray = (
        useF2E ? this.radialF2E : this.radialE2F
      ) as number[];

      const distC2PPInMM =
        cartesian2DDistance(this.principalPoint, coordinate) *
        this.pixelSize![0];
      if (distC2PPInMM === 0) {
        return coordinate.slice();
      }
      const diffX = coordinate[0] - this.principalPoint[0];
      const diffY = coordinate[1] - this.principalPoint[1];

      // get shift value
      let shift = 0;
      for (let i = 0; i < coefficientsArray.length; ++i) {
        shift += coefficientsArray[i] * distC2PPInMM ** i;
      }

      // get new position through spherical coordinates system - http://mathworld.wolfram.com/SphericalCoordinates.html
      const newDistInPixel = (distC2PPInMM + shift) / this.pixelSize![0];
      const angleTheta = Math.atan2(diffY, diffX);
      return [
        this.principalPoint[0] + newDistInPixel * Math.cos(angleTheta),
        this.principalPoint[1] + newDistInPixel * Math.sin(angleTheta),
      ];
    }

    return coordinate.slice();
  }
}

export default ObliqueImageMeta;
