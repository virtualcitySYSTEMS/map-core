import { getTransform, get as getProjection, equivalent } from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { check } from '@vcsuite/check';

/**
 * @typedef {Object} vcs.vcm.util.Projection.Options
 * @property {string|number|undefined} epsg -  EPSG of the projection, for example: "EPSG:4326" if not specified, uses the framework projection
 * @property {string|undefined} proj4 - definition of the projection. See for example: {@link http://spatialreference.org/ref/epsg/4326/proj4/} proj4
 * @property {Array<string>|undefined} alias - aliases to define
 * @api stable
 */

export const wgs84ToMercatorTransformer = getTransform('EPSG:4326', 'EPSG:3857');
export const mercatorToWgs84Transformer = getTransform('EPSG:3857', 'EPSG:4326');


/**
 * @returns {vcs-logger/Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.util.Projection');
}

/**
 * @type {vcs.vcm.util.Projection.Options}
 */
let defaultProjectionOption = {
  epsg: 'EPSG:4326',
};

/**
 * @param {string} value
 * @param {string=} [prefix="EPSG:"]
 * @returns {string}
 */
function parseEPSGCode(value, prefix = 'EPSG:') {
  const matches = `${value}`.match(/^(?:epsg:)?(\d+)/i);
  if (matches && matches[1]) {
    return `${prefix}${matches[1]}`;
  }
  return '';
}

/**
 * @param {vcs.vcm.util.Projection.Options} options
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
 * @param {vcs.vcm.util.Projection.Options} options
 * @returns {vcs.vcm.util.Projection.Options} valid options
 */
function registerProjection(options) {
  const saneOptions = {};
  if (options.epsg) {
    saneOptions.epsg = parseEPSGCode(options.epsg);
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
 * @param {vcs.vcm.util.Projection.Options} options
 * @memberOf vcs.vcm.util.Projection
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
 * @memberOf vcs.vcm.util
 */
class Projection {
  /**
   * @param {vcs.vcm.util.Projection.Options} options
   */
  constructor(options = {}) {
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
    this._epsg = saneOptions.epsg;

    if (!this.proj) {
      this._epsg = Projection.parseEPSGCode(defaultProjectionOption.epsg);
    }
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
   * @type {ol/proj/Projection}
   * @api
   * @readonly
   */
  get proj() {
    return getProjection(this.epsg);
  }

  /**
   * @returns {ol/proj/Projection}
   * @api
   * @deprecated 3.7
   */
  getProjection() {
    getLogger().deprecate('getProjection', 'Access the property proj directly');
    return this.proj;
  }

  /**
   * @param {vcs.vcm.util.Projection} projection
   * @returns {boolean}
   */
  equals(projection) {
    return equivalent(this.proj, projection.proj);
  }

  /**
   * @static
   * @param {vcs.vcm.util.Projection} dest
   * @param {vcs.vcm.util.Projection} source
   * @param {ol/Coordinate} coords
   * @returns {ol/Coordinate}
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
   * @param {vcs.vcm.util.Projection} dest
   * @param {ol/Coordinate} coords
   * @returns {ol/Coordinate}
   * @api stable
   */
  transformTo(dest, coords) {
    return Projection.transform(dest, this, coords);
  }

  /**
   * @static
   * @param {vcs.vcm.util.Projection} dest
   * @param {vcs.vcm.util.Projection} source
   * @param {Array.<ol/Coordinate>} coords
   * @returns {Array.<ol/Coordinate>}
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
   * @param {vcs.vcm.util.Projection} dest
   * @param {vcs.vcm.util.Projection} source
   * @returns {ol/proj/TransformFunction}
   */
  static getTransformer(dest, source) {
    return getTransform(source.proj, dest.proj);
  }

  /**
   * @param {vcs.vcm.util.Projection} source
   * @param {ol/Coordinate} coords
   * @returns {ol/Coordinate}
   * @api stable
   */
  transformFrom(source, coords) {
    return Projection.transform(this, source, coords);
  }

  /**
   * Returns the object literal representation of this object
   * @returns {vcs.vcm.util.Projection.Options}
   * @api stable
   */
  getConfigObject() {
    const configObject = {
      epsg: this.epsg,
    };
    if (this.proj4) {
      configObject.proj4 = this.proj4;
    }
    return configObject;
  }

  /**
   * Fast transform from Web-Mercator to WGS84
   * @param {ol/Coordinate} coords
   * @param {boolean=} inPlace - whether to transform in place
   * @returns {ol/Coordinate}
   * @api
   */
  static mercatorToWgs84(coords, inPlace) {
    return mercatorToWgs84Transformer(coords, inPlace ? coords : undefined, coords.length);
  }

  /**
   * Fast transform from WGS84 to Web-Mercator
   * @param {ol/Coordinate} coords
   * @param {boolean=} inPlace - whether to transform in place
   * @returns {ol/Coordinate}
   * @api
   */
  static wgs84ToMercator(coords, inPlace) {
    return wgs84ToMercatorTransformer(coords, inPlace ? coords : undefined, coords.length);
  }

  /**
   * validates projection options, combination of epsg code and proj4
   * @param {vcs.vcm.util.Projection.Options} options
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
 * @memberOf vcs.vcm.util
 * @returns {vcs.vcm.util.Projection}
 * @export
 */
export function getDefaultProjection() {
  return new Projection(defaultProjectionOption);
}

/**
 * wgs84 Projection EPSG Code: 4326
 * @api stable
 * @memberOf vcs.vcm.util
 * @type {vcs.vcm.util.Projection}
 * @export
 */
export const wgs84Projection = new Projection({ epsg: 4326 });
/**
 * mercator Projection EPSG Code: 3857
 * @api stable
 * @memberOf vcs.vcm.util
 * @type {vcs.vcm.util.Projection}
 * @export
 */
export const mercatorProjection = new Projection({ epsg: 3857 });
