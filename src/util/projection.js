import { getTransform, get as getProjection, equivalent } from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import { check } from '@vcsuite/check';

/**
 * @typedef {Object} ProjectionOptions
 * @property {string} [type]
 * @property {string|number} [epsg] -  EPSG of the projection, for example: "EPSG:4326" if not specified, uses the framework projection
 * @property {string|undefined|null} [proj4] - definition of the projection. See for example: {@link http://spatialreference.org/ref/epsg/4326/proj4/} proj4
 * @property {Array<string>|undefined|null} [alias] - aliases to define
 * @property {string|undefined} [prefix='EPSG:'] - an alternate prefix to use for custom projection
 * @api stable
 */
/**
 * @typedef {function(Array<number>, Array<number>=, number=): Array<number>} CorrectTransformFunction
 */

export const wgs84ToMercatorTransformer = /** @type {CorrectTransformFunction} */ (getTransform('EPSG:4326', 'EPSG:3857'));
export const mercatorToWgs84Transformer = /** @type {CorrectTransformFunction} */ (getTransform('EPSG:3857', 'EPSG:4326'));

/**
 * @type {ProjectionOptions}
 */
let defaultProjectionOption = {
  epsg: 'EPSG:4326',
};

/**
 * @param {string|number} value
 * @param {string=} [prefix="EPSG:"]
 * @returns {string}
 */
function parseEPSGCode(value, prefix = 'EPSG:') {
  const regex = new RegExp(`^(?:${prefix})?(\\d+)`, 'i');
  const matches = `${value}`.match(regex);
  if (matches && matches[1]) {
    return `${prefix}${matches[1]}`;
  }
  return '';
}

/**
 * @param {ProjectionOptions} options
 * @returns {boolean}
 */
function validateProjectionOptions(options) {
  let proj = null;
  if (options.epsg) {
    try {
      // @ts-ignore
      proj = proj4(parseEPSGCode(options.epsg));
    } catch (error) {
      proj = null;
    }
  }
  if (options.proj4) {
    try {
      // @ts-ignore
      proj = proj4(options.proj4);
    } catch (error) {
      proj = null;
    }
  }
  return proj != null;
}

/**
 * @param {ProjectionOptions} options
 * @returns {ProjectionOptions} valid options
 */
function registerProjection(options) {
  const saneOptions = {
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
          proj4.defs(alias, proj4.defs(saneOptions.epsg));
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
 * @param {ProjectionOptions} options
 * @api
 * @export
 */
export function setDefaultProjectionOptions(options) {
  check(options, { epsg: [String, Number], proj4: [String, undefined, null] });
  if (!validateProjectionOptions(options)) {
    throw new Error('Cannot set invalid projection options as default options');
  }
  defaultProjectionOption = registerProjection(options);
}

/**
 * Projection Class, if no valid options are given, the Projection will initialize with the Framework default Projection
 * @class
 * @export
 * For example:
 *     <pre><code>
 *         {
 *          "epsg" : "EPSG:25833"
 *          "proj4" : "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs"
 *         }
 *     </code></pre>
 * @api stable
 */
class Projection {
  /**
   * @returns {string}
   */
  static get className() { return 'Projection'; }

  /**
   * @param {ProjectionOptions} options
   */
  constructor(options = { epsg: '' }) {
    const saneOptions = registerProjection(options);
    /**
     * @type {string|null}
     * @private
     */
    this._proj4 = saneOptions.proj4;

    /**
     * @type {string}
     * @private
     */
    this._epsg = /** @type {string} */ (saneOptions.epsg);

    if (!this.proj) {
      this._epsg = Projection.parseEPSGCode(defaultProjectionOption.epsg);
    }

    /**
     * Cached for toJSON
     * @type {Array<string>}
     * @private
     */
    this._alias = saneOptions.alias;

    /**
     * Cached for toJSON
     * @type {string}
     * @private
     */
    this._prefix = saneOptions.prefix;
  }

  /**
   * epsg code in the format "EPSG:25832"
   * @type {string}
   * @api
   * @readonly
   */
  get epsg() {
    return this._epsg;
  }

  /**
   * proj4js string example for epsg:25832: +proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs
   * @type {string|null}
   * @api
   * @readonly
   */
  get proj4() {
    return this._proj4;
  }

  /**
   * @type {import("ol/proj/Projection").default}
   * @api
   * @readonly
   */
  get proj() {
    return getProjection(this.epsg);
  }

  /**
   * @param {Projection} projection
   * @returns {boolean}
   */
  equals(projection) {
    return equivalent(this.proj, projection.proj);
  }

  /**
   * @static
   * @param {Projection} dest
   * @param {Projection} source
   * @param {import("ol/coordinate").Coordinate} coords
   * @returns {import("ol/coordinate").Coordinate}
   * @api stable
   */
  static transform(dest, source, coords) {
    const transformer = getTransform(source.proj, dest.proj);
    const newCoords = new Array(2);
    transformer([coords[0], coords[1]], newCoords, 2);
    if (coords.length > 2) {
      newCoords.push(coords[2]);
    }
    return newCoords;
  }

  /**
   * @param {Projection} dest
   * @param {import("ol/coordinate").Coordinate} coords
   * @returns {import("ol/coordinate").Coordinate}
   * @api stable
   */
  transformTo(dest, coords) {
    return Projection.transform(dest, this, coords);
  }

  /**
   * @static
   * @param {Projection} dest
   * @param {Projection} source
   * @param {Array.<import("ol/coordinate").Coordinate>} coords
   * @returns {Array.<import("ol/coordinate").Coordinate>}
   * @api stable
   */
  static transformCoordinates(dest, source, coords) {
    const newCoords = [];
    for (let i = 0; i < coords.length; i++) {
      newCoords.push(Projection.transform(dest, source, coords[i]));
    }
    return newCoords;
  }

  /**
   * returns a function to transform coordinates from source to dest
   * @static
   * @param {Projection} dest
   * @param {Projection} source
   * @returns {import("ol/proj").TransformFunction}
   */
  static getTransformer(dest, source) {
    return getTransform(source.proj, dest.proj);
  }

  /**
   * @param {Projection} source
   * @param {import("ol/coordinate").Coordinate} coords
   * @returns {import("ol/coordinate").Coordinate}
   * @api stable
   */
  transformFrom(source, coords) {
    return Projection.transform(this, source, coords);
  }

  /**
   * Returns the object literal representation of this object
   * @returns {ProjectionOptions}
   * @api stable
   */
  toJSON() {
    const configObject = {
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
   * @param {import("ol/coordinate").Coordinate} coords
   * @param {boolean=} inPlace - whether to transform in place
   * @returns {import("ol/coordinate").Coordinate}
   * @api
   */
  static mercatorToWgs84(coords, inPlace) {
    return mercatorToWgs84Transformer(coords, inPlace ? coords : undefined, coords.length);
  }

  /**
   * Fast transform from WGS84 to Web-Mercator
   * @param {import("ol/coordinate").Coordinate} coords
   * @param {boolean=} inPlace - whether to transform in place
   * @returns {import("ol/coordinate").Coordinate}
   * @api
   */
  static wgs84ToMercator(coords, inPlace) {
    return wgs84ToMercatorTransformer(coords, inPlace ? coords : undefined, coords.length);
  }

  /**
   * validates projection options, combination of epsg code and proj4
   * @param {ProjectionOptions} options
   * @returns {boolean}
   * @api
   */
  static validateOptions(options) {
    return validateProjectionOptions(options);
  }

  /**
   * parses an epsg code returns empty string if no code has been found
   * for example:
   * parseEPSGCode('epsg:4326') ==> '4326'
   * parseEPSGCode('epsg:4326', 'EPSG:') ==> 'EPSG:4326'
   * parseEPSGCode('asdasd', 'EPSG:') ==> ''
   * @param {string|number|undefined} value
   * @param {string|undefined} prefix default EPSG:
   * @returns {string}
   * @api
   */
  static parseEPSGCode(value, prefix = 'EPSG:') {
    return parseEPSGCode(value, prefix);
  }
}

export default Projection;

/**
 * Returns the default Projection.
 * @api stable
 * @returns {Projection}
 * @export
 */
export function getDefaultProjection() {
  return new Projection(defaultProjectionOption);
}

/**
 * wgs84 Projection EPSG Code: 4326
 * @api stable
 * @type {Projection}
 * @export
 */
export const wgs84Projection = new Projection({ epsg: 4326 });
/**
 * mercator Projection EPSG Code: 3857
 * @api stable
 * @type {Projection}
 * @export
 */
export const mercatorProjection = new Projection({ epsg: 3857 });
