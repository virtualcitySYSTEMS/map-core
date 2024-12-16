import type { Extent as OLExtent } from 'ol/extent.js';
import Projection, { type ProjectionOptions } from './projection.js';

export type ExtentOptions = {
  type?: string;
  coordinates?: OLExtent;
  projection?: ProjectionOptions;
};

/**
 * checks extent validity, point extent is also valid
 * @param  extent
 */
function checkExtentValidity(extent?: OLExtent): boolean {
  if (!extent || !Array.isArray(extent) || extent.length !== 4) {
    return false;
  }

  if (
    !Number.isFinite(extent[0]) ||
    !Number.isFinite(extent[1]) ||
    !Number.isFinite(extent[2]) ||
    !Number.isFinite(extent[3])
  ) {
    return false;
  }
  return extent[0] <= extent[2] && extent[1] <= extent[3];
}

/**
 * Extent Class
 */
class Extent {
  static get className(): string {
    return 'Extent';
  }

  static get WGS_84_EXTENT(): OLExtent {
    return [-180, -90, 180, 90];
  }

  /**
   * validates extent options, checks for valid projection and the geometry of the given coordinates.
   * The Coordinate extent is also valid if its a point extent
   * @param  options
   */
  static validateOptions(options: ExtentOptions): boolean {
    return (
      Projection.validateOptions(options.projection || {}) &&
      checkExtentValidity(options.coordinates)
    );
  }

  projection: Projection;

  extent: OLExtent;

  constructor(options: ExtentOptions = {}) {
    this.projection = new Projection(options.projection);
    this.extent = options.coordinates ||
      this.projection.proj?.getExtent() || [
        -Infinity,
        -Infinity,
        Infinity,
        Infinity,
      ];
  }

  getCoordinatesInProjection(
    destination: Projection,
    result?: OLExtent,
  ): OLExtent {
    if (destination.epsg === this.projection.epsg) {
      // TODO aliases?!
      const extent = result
        ? result.splice(0, 4, ...this.extent)
        : this.extent.slice();
      return extent;
    }
    const transformer = Projection.getTransformer(destination, this.projection);
    const target = result || [];
    transformer(this.extent, target, 2);
    return target;
  }

  /**
   * only checks for null/nan numbers, does not check for spatial validity of the extent
   * @returns  true if extent is valid
   */
  isValid(): boolean {
    return checkExtentValidity(this.extent);
  }

  toJSON(): ExtentOptions {
    return {
      coordinates: this.extent.slice(),
      projection: this.projection.toJSON(),
      type: Extent.className,
    };
  }

  clone(): Extent {
    return new Extent(this.toJSON());
  }

  equals(extent: Extent): boolean {
    if (this === extent) {
      return true;
    }

    return (
      this.isValid() &&
      extent.isValid() &&
      this.extent.every((c, i) => c === extent.extent[i]) &&
      this.projection.equals(extent.projection)
    );
  }
}

export default Extent;
