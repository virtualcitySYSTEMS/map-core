import {
  getTransform,
  get as getProjection,
  equivalent,
  Projection as OLProjection,
} from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import type { Coordinate } from 'ol/coordinate.js';
import proj4 from 'proj4';
import { check, maybe, oneOf } from '@vcsuite/check';

export type ProjectionOptions = {
  type?: string;
  /**
   * EPSG of the projection, for example: "EPSG:4326" if not specified, uses the framework projection
   */
  epsg?: string | number;
  /**
   * definition of the projection. See for example: {@link http://spatialreference.org/ref/epsg/4326/proj4/} proj4
   */
  proj4?: string;
  /**
   * aliases to define
   */
  alias?: string[];
  /**
   * an alternate prefix to use for custom projection
   */
  prefix?: string;
};
export type CorrectTransformFunction = (
  arg0: number[],
  arg1?: number[],
  arg2?: number,
) => number[];

export const wgs84ToMercatorTransformer: CorrectTransformFunction =
  getTransform('EPSG:4326', 'EPSG:3857');
export const mercatorToWgs84Transformer: CorrectTransformFunction =
  getTransform('EPSG:3857', 'EPSG:4326');

let defaultProjectionOption: ProjectionOptions = {
  epsg: 'EPSG:4326',
};

export function parseEPSGCode(
  value?: string | number,
  prefix = 'EPSG:',
): string {
  if (value) {
    const regex = new RegExp(`^(?:${prefix})?:?(\\d+)`, 'i');
    const matches = `${value}`.match(regex);
    if (matches && matches[1]) {
      if (prefix) {
        if (prefix.endsWith(':')) {
          return `${prefix}${matches[1]}`;
        }
        return `${prefix}:${matches[1]}`;
      }
      return matches[1];
    }
  }
  return '';
}

function validateProjectionOptions(options: ProjectionOptions): boolean {
  let proj = null;
  const epsg = parseEPSGCode(options.epsg, options.prefix);

  if (epsg) {
    try {
      proj = proj4(parseEPSGCode(epsg));
    } catch (error) {
      proj = null;
    }

    if (options.proj4) {
      try {
        proj = proj4(options.proj4);
      } catch (error) {
        proj = null;
      }
    }
  }

  return proj != null;
}

function registerProjection(options: ProjectionOptions): ProjectionOptions {
  const saneOptions: ProjectionOptions = {
    prefix: options.prefix,
  };
  if (options.epsg) {
    saneOptions.epsg = parseEPSGCode(options.epsg, options.prefix);
    if (saneOptions.epsg) {
      if (options.proj4) {
        saneOptions.proj4 = options.proj4;
        proj4.defs(saneOptions.epsg, options.proj4);
        register(proj4);
      }
      if (options.alias && Array.isArray(options.alias)) {
        saneOptions.alias = options.alias;
        saneOptions.alias.forEach((alias) => {
          proj4.defs(alias, proj4.defs(saneOptions.epsg as string));
          register(proj4);
        });
      }
    }
  }
  return saneOptions;
}

/**
 * Set the default projections epsg and proj4. Does not update
 * projection created prior to this functions call.
 */
export function setDefaultProjectionOptions(options: ProjectionOptions): void {
  check(options, {
    epsg: oneOf(String, Number),
    proj4: maybe(String),
  });
  if (!validateProjectionOptions(options)) {
    throw new Error('Cannot set invalid projection options as default options');
  }
  defaultProjectionOption = registerProjection(options);
}

/**
 * Projection Class, if no valid options are given, the Projection will initialize with the Framework default Projection
 * For example:
 *     <pre><code>
 *         {
 *          "epsg" : "EPSG:25833"
 *          "proj4" : "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs"
 *         }
 *     </code></pre>
 */
class Projection {
  static get className(): string {
    return 'Projection';
  }

  private _proj4: string | undefined;

  private _epsg: string;

  private _alias: string[] | undefined;

  private _prefix: string | undefined;

  constructor(options: ProjectionOptions = { epsg: '' }) {
    const saneOptions = registerProjection(options);
    this._proj4 = saneOptions.proj4;
    this._epsg = String(saneOptions.epsg);

    if (!this.proj) {
      this._epsg = Projection.parseEPSGCode(defaultProjectionOption.epsg);
    }

    this._alias = saneOptions.alias;
    this._prefix = saneOptions.prefix;
  }

  get epsg(): string {
    return this._epsg;
  }

  get proj4(): string | undefined {
    return this._proj4;
  }

  get proj(): OLProjection {
    return getProjection(this.epsg) as OLProjection;
  }

  equals(projection: Projection): boolean {
    return equivalent(this.proj, projection.proj);
  }

  static transform(
    dest: Projection,
    source: Projection,
    coords: Coordinate,
  ): Coordinate {
    const transformer = getTransform(source.proj, dest.proj);
    const newCoords: Coordinate = [0, 0];
    transformer([coords[0], coords[1]], newCoords, 2);
    if (coords.length > 2) {
      newCoords.push(coords[2]);
    }
    return newCoords;
  }

  transformTo(dest: Projection, coords: Coordinate): Coordinate {
    return Projection.transform(dest, this, coords);
  }

  static transformCoordinates(
    dest: Projection,
    source: Projection,
    coords: Coordinate[],
  ): Coordinate[] {
    const newCoords = [];
    for (let i = 0; i < coords.length; i++) {
      newCoords.push(Projection.transform(dest, source, coords[i]));
    }
    return newCoords;
  }

  /**
   * returns a function to transform coordinates from source to dest
   */
  static getTransformer(
    dest: Projection,
    source: Projection,
  ): CorrectTransformFunction {
    return getTransform(source.proj, dest.proj);
  }

  transformFrom(source: Projection, coords: Coordinate): Coordinate {
    return Projection.transform(this, source, coords);
  }

  /**
   * Returns the object literal representation of this object
   */
  toJSON(): ProjectionOptions {
    const configObject: ProjectionOptions = {
      type: Projection.className,
      epsg: this.epsg,
    };
    if (this.proj4) {
      configObject.proj4 = this.proj4;
    }
    if (Array.isArray(this._alias) && this._alias.length > 0) {
      configObject.alias = this._alias.slice();
    }
    if (this._prefix) {
      configObject.prefix = this._prefix;
    }
    return configObject;
  }

  /**
   * Fast transform from Web-Mercator to WGS84
   * @param  inPlace - whether to transform in place
   */
  static mercatorToWgs84(coords: Coordinate, inPlace?: boolean): Coordinate {
    return mercatorToWgs84Transformer(
      coords,
      inPlace ? coords : undefined,
      coords.length,
    );
  }

  /**
   * Fast transform from WGS84 to Web-Mercator
   * @param  inPlace - whether to transform in place
   */
  static wgs84ToMercator(coords: Coordinate, inPlace?: boolean): Coordinate {
    return wgs84ToMercatorTransformer(
      coords,
      inPlace ? coords : undefined,
      coords.length,
    );
  }

  /**
   * validates projection options, combination of epsg code and proj4
   */
  static validateOptions(options: ProjectionOptions): boolean {
    return validateProjectionOptions(options);
  }

  /**
   * parses an epsg code returns empty string if no code has been found
   * for example:
   * parseEPSGCode('epsg:4326') ==> '4326'
   * parseEPSGCode('epsg:4326', 'EPSG:') ==> 'EPSG:4326'
   * parseEPSGCode('asdasd', 'EPSG:') ==> ''
   */
  static parseEPSGCode(value?: string | number, prefix = 'EPSG:'): string {
    return parseEPSGCode(value, prefix);
  }
}

export default Projection;

/**
 * Returns the default Projection.
 */
export function getDefaultProjection(): Projection {
  return new Projection(defaultProjectionOption);
}

/**
 * wgs84 Projection EPSG Code: 4326
 */
export const wgs84Projection = new Projection({ epsg: 4326 });

/**
 * mercator Projection EPSG Code: 3857
 */
export const mercatorProjection = new Projection({ epsg: 3857 });
