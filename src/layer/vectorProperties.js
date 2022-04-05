import deepEqual from 'fast-deep-equal';
import { HeightReference, ClassificationType, NearFarScalar, Cartesian3 } from '@vcmap/cesium';
import { check, checkMaybe } from '@vcsuite/check';
import { parseBoolean, parseEnumKey, parseNumber, parseInteger } from '@vcsuite/parsers';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import VcsEvent from '../vcsEvent.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('VectorProperties');
}

/**
 * @typedef {Object} VectorPropertiesOptions
 * @property {string|undefined} [altitudeMode=relativeToGround] - (3D) Either "relativeToGround", "clampToGround" or 'absolute'
 * @property {boolean|undefined} [allowPicking=true] - if the features are pickable
 * @property {string|undefined} [classificationType=undefined] - (3D) the cesium classification type for this layer. one of 'both', 'terrain' or 'cesium3DTile'
 * @property {Array<number>|undefined} [scaleByDistance=undefined] - (3D) Array with 4 numbers by which features are being scaled based on distance see <a href="https://cesium.com/docs/cesiumjs-ref-doc/Billboard.html#scaleByDistance"> here </a>
 * @property {Array<number>|undefined} [eyeOffset=undefined] - (3D) Array with 3 numbers see for explanation: <a href="https://cesium.com/docs/cesiumjs-ref-doc/Billboard.html#eyeOffset"> here </a>
 * @property {number|undefined} [heightAboveGround=0] - (3D) can be used with altitudeMode relativeToGround
 * @property {number|undefined} [skirt=0] - (3D) default skirt value to use for extruded features
 * @property {number|undefined} [groundLevel=undefined] - (3D) ground height level of the objects
 * @property {number|undefined} [extrudedHeight=0] - (3D) - default layer extruded Height
 * @property {number|undefined} [storeysAboveGround=0] - (3D)
 * @property {number|undefined} [storeysBelowGround=0] - (3D)
 * @property {Array<number>|number|undefined} [storeyHeightsAboveGround=[]] - (3D)
 * @property {Array<number>|number|undefined} [storeyHeightsBelowGround=[]] - (3D)
 * @property {number|undefined} [storeyHeight=undefined] - vcs:undocumented   @deprecated 3.8 default storey height to use for extruded features to draw storey lines
 * @property {string|undefined} modelUrl
 * @property {number} [modelScaleX=1]
 * @property {number} [modelScaleY=1]
 * @property {number} [modelScaleZ=1]
 * @property {number} [modelHeading=0] - in degrees
 * @property {number} [modelPitch=0] - in degrees
 * @property {number} [modelRoll=0] - in degrees
 * @property {Object|undefined} modelOptions - Model options are merged with the model definition from model url, scale and orientation and accepts any option passed to a Cesium.Model.
 * @property {string|undefined} baseUrl - a base URL to resolve relative model URLs against.
 * @api
 */

/**
 * @typedef {Object} VectorPropertiesModelOptions
 * @property {string} url
 * @property {Array<number>} scale
 * @property {number} heading
 * @property {number} pitch
 * @property {number} roll
 * @api
 */

/**
 * @enum {import("@vcmap/cesium").HeightReference}
 * @const
 */
export const AltitudeModeCesium = {
  clampToGround: HeightReference.CLAMP_TO_GROUND,
  absolute: HeightReference.NONE,
  relativeToGround: HeightReference.RELATIVE_TO_GROUND,
};

/**
 * @enum {import("@vcmap/cesium").ClassificationType}
 * @const
 */
export const ClassificationTypeCesium = {
  both: ClassificationType.BOTH,
  cesium3DTile: ClassificationType.CESIUM_3D_TILE,
  terrain: ClassificationType.TERRAIN,
};

/**
 * @param {Array<number>} value
 * @param {import("@vcmap/cesium").NearFarScalar|undefined} defaultValue
 * @returns {import("@vcmap/cesium").NearFarScalar|undefined}
 */
export function parseNearFarScalar(value, defaultValue) {
  if (Array.isArray(value)) {
    const valid = value
      .map(entry => parseNumber(entry, null))
      .filter(entry => entry != null);
    if (valid.length === 4) {
      return new NearFarScalar(valid[0], valid[1], valid[2], valid[3]);
    }
  }
  return defaultValue;
}

/**
 * @param {Array<number>} value
 * @param {import("@vcmap/cesium").Cartesian3|undefined} defaultValue
 * @returns {import("@vcmap/cesium").Cartesian3|undefined}
 */
export function parseCartesian3(value, defaultValue) {
  if (Array.isArray(value)) {
    const valid = value
      .map(entry => parseNumber(entry, null))
      .filter(entry => entry != null);
    if (valid.length === 3) {
      return new Cartesian3(valid[0], valid[1], valid[2]);
    }
  }
  return defaultValue;
}

/**
 * returns a storeyHeight array
 * @param {Array<number>|number} storeyHeights
 * @param {Array<number>|number} defaultStoreyHeights
 * @returns {Array<number>}
 */
export function parseStoreyHeights(storeyHeights, defaultStoreyHeights) {
  if (Array.isArray(storeyHeights)) {
    return storeyHeights
      .map(value => parseNumber(value, null))
      .filter(value => value !== null && value > 0);
  } else {
    const numberValue = parseNumber(storeyHeights, null);
    if (numberValue && numberValue > 0) {
      return [numberValue];
    }
  }
  if (!Array.isArray(defaultStoreyHeights)) {
    return [defaultStoreyHeights];
  }
  return defaultStoreyHeights;
}

/**
 * @param {import("@vcmap/cesium").HeightReference} altitudeMode
 * @returns {string}
 */
export function getAltitudeModeOptions(altitudeMode) {
  return Object.keys(AltitudeModeCesium)
    .find(key => AltitudeModeCesium[key] === altitudeMode);
}

/**
 * @param {import("@vcmap/cesium").ClassificationType} classificationType
 * @returns {string}
 */
export function getClassificationTypeOptions(classificationType) {
  return Object.keys(ClassificationTypeCesium)
    .find(key => ClassificationTypeCesium[key] === classificationType);
}

/**
 * @param {import("@vcmap/cesium").NearFarScalar} nearFarScalar
 * @returns {Array<number>|undefined}
 */
export function getNearFarValueOptions(nearFarScalar) {
  return nearFarScalar ? NearFarScalar.pack(nearFarScalar, []) : undefined;
}

/**
 * @param {import("@vcmap/cesium").Cartesian3} cartesian3
 * @returns {Array<number>|undefined}
 */
export function getCartesian3Options(cartesian3) {
  return cartesian3 ? Cartesian3.pack(cartesian3, []) : undefined;
}

/**
 * Properties Collection for VectorLayer Features
 * @class
 * @export
 * @api stable
 */
class VectorProperties {
  /**
   * Returns the default options for VectorProperties
   * @returns {VectorPropertiesOptions}
   * @api
   */
  static getDefaultOptions() {
    // implementation detail, be careful, defaultValues are not used everywhere, check in constructor and elsewhere
    return {
      altitudeMode: 'clampToGround',
      allowPicking: true,
      classificationType: undefined,
      scaleByDistance: undefined,
      eyeOffset: undefined,
      heightAboveGround: 0,
      skirt: 0,
      groundLevel: undefined,
      extrudedHeight: 0,
      storeysAboveGround: 0,
      storeysBelowGround: 0,
      storeyHeightsAboveGround: [],
      storeyHeightsBelowGround: [],
      storeyHeight: undefined,
      modelUrl: undefined,
      modelScaleX: 1,
      modelScaleY: 1,
      modelScaleZ: 1,
      modelHeading: 0,
      modelPitch: 0,
      modelRoll: 0,
      modelOptions: undefined,
      baseUrl: undefined,
    };
  }

  /**
   * @param {VectorPropertiesOptions} options
   */
  constructor(options) {
    const defaultValues = VectorProperties.getDefaultOptions();
    /**
     * @type {import("@vcmap/cesium").HeightReference}
     * @private
     */
    this._altitudeMode = parseEnumKey(options.altitudeMode, AltitudeModeCesium, HeightReference.CLAMP_TO_GROUND);

    /**
     * @type {boolean}
     * @private
     */
    this._allowPicking = parseBoolean(options.allowPicking, defaultValues.allowPicking);

    /**
     * @type {import("@vcmap/cesium").ClassificationType|undefined}
     * @private
     */
    this._classificationType = parseEnumKey(options.classificationType, ClassificationTypeCesium, undefined);


    /**
     * @type {import("@vcmap/cesium").NearFarScalar|undefined}
     * @private
     */
    this._scaleByDistance = parseNearFarScalar(options.scaleByDistance, undefined);

    /**
     * @type {import("@vcmap/cesium").Cartesian3|undefined}
     * @private
     */
    this._eyeOffset = parseCartesian3(options.eyeOffset, undefined);

    /**
     * @type {number}
     * @private
     */
    this._heightAboveGround = parseNumber(options.heightAboveGround, defaultValues.heightAboveGround);

    /**
     * @type {number}
     * @private
     */
    this._skirt = parseNumber(options.skirt, defaultValues.skirt);

    /**
     * @type {number|undefined}
     * @private
     */
    this._groundLevel = parseNumber(options.groundLevel, defaultValues.groundLevel);

    /**
     * @type {number}
     * @private
     */
    this._extrudedHeight = parseNumber(options.extrudedHeight, defaultValues.extrudedHeight);

    /**
     * @type {number}
     * @private
     */
    this._storeysAboveGround = parseInteger(options.storeysAboveGround, defaultValues.storeysAboveGround);

    /**
     * @type {number}
     * @private
     */
    this._storeysBelowGround = parseInteger(options.storeysBelowGround, defaultValues.storeysBelowGround);

    /**
     * @type {Array<number>}
     * @private
     */
    this._storeyHeightsAboveGround =
      parseStoreyHeights(options.storeyHeightsAboveGround, defaultValues.storeyHeightsAboveGround);

    /**
     * @type {Array<number>}
     * @private
     */
    this._storeyHeightsBelowGround =
      parseStoreyHeights(options.storeyHeightsBelowGround, defaultValues.storeyHeightsBelowGround);

    /**
     * @type {number|undefined}
     * @private
     * @deprecated v3.8
     */
    this._storeyHeight = parseNumber(options.storeyHeight, defaultValues.storeyHeight);

    /**
     * @type {string}
     * @private
     */
    this._modelUrl = options.modelUrl || defaultValues.modelUrl;

    /**
     * @type {number}
     * @private
     */
    this._modelScaleX = parseNumber(options.modelScaleX, defaultValues.modelScaleX);
    /**
     * @type {number}
     * @private
     */
    this._modelScaleY = parseNumber(options.modelScaleY, defaultValues.modelScaleY);
    /**
     * @type {number}
     * @private
     */
    this._modelScaleZ = parseNumber(options.modelScaleZ, defaultValues.modelScaleZ);

    /**
     * @type {number}
     * @private
     */
    this._modelHeading = parseNumber(options.modelHeading, defaultValues.modelHeading);

    /**
     * @type {number}
     * @private
     */
    this._modelPitch = parseNumber(options.modelPitch, defaultValues.modelPitch);

    /**
     * @type {number}
     * @private
     */
    this._modelRoll = parseNumber(options.modelRoll, defaultValues.modelRoll);

    /**
     * @type {string}
     * @private
     */
    this._baseUrl = options.baseUrl || defaultValues.baseUrl;

    /**
     * @type {Object|undefined}
     * @private
     */
    this._modelOptions = options.modelOptions || defaultValues.modelOptions;

    /**
     * Event raised when properties change. is passed an array of keys for the changed properties.
     * @type {VcsEvent<Array<string>>}
     * @readonly
     * @api
     */
    this.propertyChanged = new VcsEvent();
  }

  /**
   * @type {import("@vcmap/cesium").HeightReference}
   * @api
   */
  get altitudeMode() {
    return this._altitudeMode;
  }

  /**
   * @param {import("@vcmap/cesium").HeightReference} altitudeMode
   */
  set altitudeMode(altitudeMode) {
    if (altitudeMode !== this._altitudeMode) {
      check(altitudeMode, Object.values(HeightReference));
      this._altitudeMode = altitudeMode;
      this.propertyChanged.raiseEvent(['altitudeMode']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("@vcmap/cesium").HeightReference}
   * @api
   */
  getAltitudeMode(feature) {
    const featureValue = feature.get('olcs_altitudeMode');
    return parseEnumKey(featureValue, AltitudeModeCesium, this._altitudeMode);
  }

  /**
   * @type {boolean}
   * @api
   */
  get allowPicking() {
    return this._allowPicking;
  }

  /**
   * @param {boolean} allowPicking
   */
  set allowPicking(allowPicking) {
    if (allowPicking !== this._allowPicking) {
      check(allowPicking, Boolean);
      this._allowPicking = allowPicking;
      this.propertyChanged.raiseEvent(['allowPicking']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {boolean}
   * @api
   */
  getAllowPicking(feature) {
    const allowPicking = feature.get('olcs_allowPicking');
    return parseBoolean(allowPicking, this._allowPicking);
  }


  /**
   * @type {import("@vcmap/cesium").ClassificationType|undefined}
   * @api
   */
  get classificationType() {
    return this._classificationType;
  }

  /**
   * @param {import("@vcmap/cesium").ClassificationType|undefined} classificationType
   */
  set classificationType(classificationType) {
    if (classificationType !== this._classificationType) {
      checkMaybe(classificationType, Object.values(ClassificationType));
      this._classificationType = classificationType;
      this.propertyChanged.raiseEvent(['classificationType']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("@vcmap/cesium").ClassificationType|undefined}
   * @api
   */
  getClassificationType(feature) {
    const classificationType = feature.get('olcs_classificationType');
    return parseEnumKey(classificationType, ClassificationTypeCesium, this.classificationType);
  }

  /**
   * @type {import("@vcmap/cesium").NearFarScalar|undefined}
   * @api
   */
  get scaleByDistance() {
    return this._scaleByDistance;
  }

  /**
   * @param {import("@vcmap/cesium").NearFarScalar|undefined} value
   */
  set scaleByDistance(value) {
    if (!NearFarScalar.equals(value, this._scaleByDistance)) {
      checkMaybe(value, NearFarScalar);
      this._scaleByDistance = value;
      this.propertyChanged.raiseEvent(['scaleByDistance']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("@vcmap/cesium").NearFarScalar|undefined}
   * @api
   */
  getScaleByDistance(feature) {
    const featureValue = feature.get('olcs_scaleByDistance');
    return parseNearFarScalar(featureValue, this.scaleByDistance);
  }

  /**
   * @type {import("@vcmap/cesium").Cartesian3|undefined}
   * @api
   */
  get eyeOffset() {
    return this._eyeOffset;
  }

  /**
   * @param {import("@vcmap/cesium").Cartesian3|undefined} value
   */
  set eyeOffset(value) {
    if (!Cartesian3.equals(this.eyeOffset, value)) {
      checkMaybe(value, Cartesian3);
      this._eyeOffset = value;
      this.propertyChanged.raiseEvent(['eyeOffset']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("@vcmap/cesium").Cartesian3}
   * @api
   */
  getEyeOffset(feature) {
    const featureValue = feature.get('olcs_eyeOffset');
    if (!featureValue) {
      const zCoordinateEyeOffset = feature.get('olcs_zCoordinateEyeOffset');
      if (zCoordinateEyeOffset) {
        getLogger().deprecate('zCoordinateEyeOffset', 'use eyeOffset and provide [0,0,value]');
        return new Cartesian3(0, 0, parseNumber(zCoordinateEyeOffset, 0));
      }
    }
    return parseCartesian3(featureValue, this.eyeOffset);
  }

  /**
   * @type {number}
   * @api
   */
  get heightAboveGround() {
    return this._heightAboveGround;
  }

  /**
   * @param {number} value
   */
  set heightAboveGround(value) {
    if (value !== this._heightAboveGround) {
      check(value, Number);
      this._heightAboveGround = value;
      this.propertyChanged.raiseEvent(['heightAboveGround']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getHeightAboveGround(feature) {
    const featureValue = feature.get('olcs_heightAboveGround');
    return parseNumber(featureValue, this.heightAboveGround);
  }

  /**
   * @type {number}
   * @api
   */
  get skirt() {
    return this._skirt;
  }

  /**
   * @param {number} value
   */
  set skirt(value) {
    if (value !== this._skirt) {
      check(value, Number);
      this._skirt = value;
      this.propertyChanged.raiseEvent(['skirt']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getSkirt(feature) {
    const featureValue = feature.get('olcs_skirt');
    return parseNumber(featureValue, this.skirt);
  }

  /**
   * @type {number|undefined}
   * @api
   */
  get groundLevel() {
    return this._groundLevel;
  }

  /**
   * @param {number|undefined} value
   */
  set groundLevel(value) {
    if (value !== this._groundLevel) {
      checkMaybe(value, Number);
      this._groundLevel = value;
      this.propertyChanged.raiseEvent(['groundLevel']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number|undefined}
   * @api
   */
  getGroundLevel(feature) {
    const featureValue = feature.get('olcs_groundLevel');
    return parseNumber(featureValue, this.groundLevel);
  }

  /**
   * @type {number}
   * @api
   */
  get extrudedHeight() {
    return this._extrudedHeight;
  }

  /**
   * @param {number} value
   */
  set extrudedHeight(value) {
    if (value !== this._extrudedHeight) {
      check(value, Number);
      this._extrudedHeight = value;
      this.propertyChanged.raiseEvent(['extrudedHeight']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getExtrudedHeight(feature) {
    const featureValue = feature.get('olcs_extrudedHeight');
    return parseNumber(featureValue, this.extrudedHeight);
  }

  /**
   * @type {number}
   * @api
   */
  get storeysAboveGround() {
    return this._storeysAboveGround;
  }

  /**
   * @param {number} value
   */
  set storeysAboveGround(value) {
    if (value !== this._storeysAboveGround) {
      check(value, Number);
      this._storeysAboveGround = Math.trunc(value);
      this.propertyChanged.raiseEvent(['storeysAboveGround']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getStoreysAboveGround(feature) {
    const featureValue = feature.get('olcs_storeysAboveGround');
    return parseInteger(featureValue, this.storeysAboveGround);
  }

  /**
   * @type {number}
   * @api
   */
  get storeysBelowGround() {
    return this._storeysBelowGround;
  }

  /**
   * @param {number} value
   */
  set storeysBelowGround(value) {
    if (value !== this._storeysBelowGround) {
      check(value, Number);
      this._storeysBelowGround = Math.trunc(value);
      this.propertyChanged.raiseEvent(['storeysBelowGround']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getStoreysBelowGround(feature) {
    const featureValue = feature.get('olcs_storeysBelowGround');
    return parseInteger(featureValue, this.storeysBelowGround);
  }

  /**
   * @type {Array<number>}
   * @api
   */
  get storeyHeightsAboveGround() {
    return this._storeyHeightsAboveGround.slice();
  }

  /**
   * @param {Array<number>} value
   */
  set storeyHeightsAboveGround(value) {
    if (!deepEqual(value, this._storeyHeightsAboveGround)) {
      check(value, [Number]);
      this._storeyHeightsAboveGround = value;
      this.propertyChanged.raiseEvent(['storeyHeightsAboveGround']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {Array<number>}
   * @api
   */
  getStoreyHeightsAboveGround(feature) {
    const featureValue = feature.get('olcs_storeyHeightsAboveGround');
    return parseStoreyHeights(featureValue, this.storeyHeightsAboveGround);
  }

  /**
   * @type {Array<number>}
   * @api
   */
  get storeyHeightsBelowGround() {
    return this._storeyHeightsBelowGround.slice();
  }

  /**
   * @param {Array<number>} value
   */
  set storeyHeightsBelowGround(value) {
    if (!deepEqual(value, this._storeyHeightsBelowGround)) {
      check(value, [Number]);
      this._storeyHeightsBelowGround = value;
      this.propertyChanged.raiseEvent(['storeyHeightsBelowGround']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {Array<number>}
   * @api
   */
  getStoreyHeightsBelowGround(feature) {
    const featureValue = feature.get('olcs_storeyHeightsBelowGround');
    return parseStoreyHeights(featureValue, this.storeyHeightsBelowGround);
  }

  /**
   * @type {number|undefined}
   * @deprecated v3.8
   */
  get storeyHeight() {
    return this._storeyHeight;
  }

  /**
   * @param {number|undefined} value
   * @deprecated v3.8
   */
  set storeyHeight(value) {
    if (value !== this._storeyHeight) {
      getLogger().deprecate('storeyHeight', 'use storeyHeightAboveGround');
      check(value, Number);
      this._storeyHeight = value;
      this.propertyChanged.raiseEvent(['storeyHeight']);
    }
  }

  /**
   * @api
   * @type {string}
   */
  get modelUrl() {
    return this._modelUrl;
  }

  /**
   * @param {string} value
   */
  set modelUrl(value) {
    check(value, String);

    if (this._modelUrl !== value) {
      this._modelUrl = value;
      this.propertyChanged.raiseEvent(['modelUrl']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {string}
   * @api
   */
  getModelUrl(feature) {
    const featureValue = feature.get('olcs_modelUrl');
    return featureValue !== undefined ? featureValue : this.modelUrl;
  }

  /**
   * @api
   * @type {number}
   */
  get modelScaleX() {
    return this._modelScaleX;
  }

  /**
   * @param {number} value
   */
  set modelScaleX(value) {
    check(value, Number);

    if (this._modelScaleX !== value) {
      this._modelScaleX = value;
      this.propertyChanged.raiseEvent(['modelScaleX']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelScaleX(feature) {
    const featureValue = feature.get('olcs_modelScaleX');
    return parseNumber(featureValue, this.modelScaleX);
  }

  /**
   * @api
   * @type {number}
   */
  get modelScaleY() {
    return this._modelScaleY;
  }

  /**
   * @param {number} value
   */
  set modelScaleY(value) {
    check(value, Number);

    if (this._modelScaleY !== value) {
      this._modelScaleY = value;
      this.propertyChanged.raiseEvent(['modelScaleY']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelScaleY(feature) {
    const featureValue = feature.get('olcs_modelScaleY');
    return parseNumber(featureValue, this.modelScaleY);
  }

  /**
   * @api
   * @type {number}
   */
  get modelScaleZ() {
    return this._modelScaleZ;
  }

  /**
   * @param {number} value
   */
  set modelScaleZ(value) {
    check(value, Number);

    if (this._modelScaleZ !== value) {
      this._modelScaleZ = value;
      this.propertyChanged.raiseEvent(['modelScaleZ']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelScaleZ(feature) {
    const featureValue = feature.get('olcs_modelScaleZ');
    return parseNumber(featureValue, this.modelScaleZ);
  }

  /**
   * @api
   * @type {number}
   */
  get modelHeading() {
    return this._modelHeading;
  }

  /**
   * @param {number} value
   */
  set modelHeading(value) {
    check(value, Number);

    if (this._modelHeading !== value) {
      this._modelHeading = value;
      this.propertyChanged.raiseEvent(['modelHeading']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelHeading(feature) {
    const featureValue = feature.get('olcs_modelHeading');
    return parseNumber(featureValue, this.modelHeading);
  }

  /**
   * @api
   * @type {number}
   */
  get modelPitch() {
    return this._modelPitch;
  }

  /**
   * @param {number} value
   */
  set modelPitch(value) {
    check(value, Number);

    if (this._modelPitch !== value) {
      this._modelPitch = value;
      this.propertyChanged.raiseEvent(['modelPitch']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelPitch(feature) {
    const featureValue = feature.get('olcs_modelPitch');
    return parseNumber(featureValue, this.modelPitch);
  }

  /**
   * @api
   * @type {number}
   */
  get modelRoll() {
    return this._modelRoll;
  }

  /**
   * @param {number} value
   */
  set modelRoll(value) {
    check(value, Number);

    if (this._modelRoll !== value) {
      this._modelRoll = value;
      this.propertyChanged.raiseEvent(['modelRoll']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {number}
   * @api
   */
  getModelRoll(feature) {
    const featureValue = feature.get('olcs_modelRoll');
    return parseNumber(featureValue, this.modelRoll);
  }

  /**
   * Model options are merged with the model definition from model url, scale and orientation and accepts any option
   * passed to a Cesium.Model.
   * @type {Object|undefined}
   * @api
   */
  get modelOptions() {
    return this._modelOptions;
  }

  /**
   * @param {Object|undefined} modelOptions
   */
  set modelOptions(modelOptions) {
    checkMaybe(modelOptions, Object);

    if (this._modelOptions !== modelOptions) {
      this._modelOptions = modelOptions;
      this.propertyChanged.raiseEvent(['modelOptions']);
    }
  }

  /**
   * Get the features or the properties modelOptions. Returns an empty Object if both are undefined
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {Object}
   * @api
   */
  getModelOptions(feature) {
    const featureValue = feature.get('olcs_modelOptions');
    if (featureValue) {
      return featureValue;
    }
    if (this.modelOptions) {
      return this.modelOptions;
    }
    return {};
  }

  /**
   * @api
   * @type {string}
   */
  get baseUrl() {
    return this._baseUrl;
  }

  /**
   * @param {string} value
   */
  set baseUrl(value) {
    check(value, String);

    if (this._baseUrl !== value) {
      this._baseUrl = value;
      this.propertyChanged.raiseEvent(['baseUrl']);
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {string}
   * @api
   */
  getBaseUrl(feature) {
    const featureValue = feature.get('olcs_baseUrl');
    return featureValue !== undefined ? featureValue : this.baseUrl;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {VectorPropertiesModelOptions|null}
   * @api
   */
  getModel(feature) {
    let url = this.getModelUrl(feature);
    if (!url) {
      return null;
    }

    const baseUrl = this.getBaseUrl(feature);
    if (baseUrl) {
      url = (new URL(url, baseUrl)).toString();
    }

    return {
      url,
      scale: [this.getModelScaleX(feature), this.getModelScaleY(feature), this.getModelScaleZ(feature)],
      heading: this.getModelHeading(feature),
      pitch: this.getModelPitch(feature),
      roll: this.getModelRoll(feature),
    };
  }

  /**
   * resets values, either given, or default Value raises propertyChanged event once;
   * @param {VcsMeta} vcsMeta
   */
  setVcsMeta(vcsMeta) {
    const options = VectorProperties.getDefaultOptions();
    // special case, setVCSMeta should not restore the altitudeMode default
    if (!vcsMeta.altitudeMode) {
      vcsMeta.altitudeMode = getAltitudeModeOptions(this.altitudeMode);
    }
    Object.assign(options, vcsMeta);
    this.setValues(options);
  }

  /**
   * sets given values only raises propertyChanged event if a value has been set;
   * @param {VectorPropertiesOptions} options
   */
  setValues(options) {
    const defaultValues = VectorProperties.getDefaultOptions();
    const changedProperties = [];
    // check if key exists in options, to also set undefined values
    if ('altitudeMode' in options) {
      const defaultAltitudeMode = parseEnumKey(defaultValues.altitudeMode, AltitudeModeCesium, undefined);
      const parsedAltitudeMode = parseEnumKey(options.altitudeMode, AltitudeModeCesium, defaultAltitudeMode);
      if (this._altitudeMode !== parsedAltitudeMode) {
        this._altitudeMode = parsedAltitudeMode;
        changedProperties.push('altitudeMode');
      }
    }

    if ('allowPicking' in options) {
      const parsedAllowPicking = parseBoolean(options.allowPicking, defaultValues.allowPicking);
      if (this._allowPicking !== parsedAllowPicking) {
        this._allowPicking = parsedAllowPicking;
        changedProperties.push('allowPicking');
      }
    }

    if ('classificationType' in options) {
      const defaultClassificationType =
        parseEnumKey(defaultValues.classificationType, ClassificationTypeCesium, undefined);
      const parsedClassificationType =
        parseEnumKey(options.classificationType, ClassificationTypeCesium, defaultClassificationType);
      if (this._classificationType !== parsedClassificationType) {
        this._classificationType = parsedClassificationType;
        changedProperties.push('classificationType');
      }
    }

    if ('scaleByDistance' in options) {
      const parsedScaleByDistance = parseNearFarScalar(options.scaleByDistance, undefined);
      if (!NearFarScalar.equals(parsedScaleByDistance, this._scaleByDistance)) {
        this._scaleByDistance = parsedScaleByDistance;
        changedProperties.push('scaleByDistance');
      }
    }

    if ('eyeOffset' in options) {
      const parsedEyeOffset = parseCartesian3(options.eyeOffset, undefined);
      if (!Cartesian3.equals(parsedEyeOffset, this._eyeOffset)) {
        this._eyeOffset = parsedEyeOffset;
        changedProperties.push('eyeOffset');
      }
    }

    if ('heightAboveGround' in options) {
      const parsedHeightAboveGround = parseNumber(options.heightAboveGround, defaultValues.heightAboveGround);
      if (parsedHeightAboveGround !== this._heightAboveGround) {
        this._heightAboveGround = parsedHeightAboveGround;
        changedProperties.push('heightAboveGround');
      }
    }

    if ('skirt' in options) {
      const parsedSkirt = parseNumber(options.skirt, defaultValues.skirt);
      if (parsedSkirt !== this._skirt) {
        this._skirt = parsedSkirt;
        changedProperties.push('skirt');
      }
    }

    if ('groundLevel' in options) {
      const parsedGroundLevel = parseNumber(options.groundLevel, defaultValues.groundLevel);
      if (parsedGroundLevel !== this._groundLevel) {
        this._groundLevel = parsedGroundLevel;
        changedProperties.push('groundLevel');
      }
    }

    if ('extrudedHeight' in options) {
      const parsedExtrudedHeight = parseNumber(options.extrudedHeight, defaultValues.extrudedHeight);
      if (parsedExtrudedHeight !== this._extrudedHeight) {
        this._extrudedHeight = parsedExtrudedHeight;
        changedProperties.push('extrudedHeight');
      }
    }
    if ('storeysAboveGround' in options) {
      const parsedStoreysAboveGround = parseInteger(options.storeysAboveGround, defaultValues.storeysAboveGround);
      if (parsedStoreysAboveGround !== this._storeysAboveGround) {
        this._storeysAboveGround = parsedStoreysAboveGround;
        changedProperties.push('storeysAboveGround');
      }
    }
    if ('storeysBelowGround' in options) {
      const parsedStoreysBelowGround = parseInteger(options.storeysBelowGround, defaultValues.storeysBelowGround);
      if (parsedStoreysBelowGround !== this._storeysBelowGround) {
        this._storeysBelowGround = parsedStoreysBelowGround;
        changedProperties.push('storeysBelowGround');
      }
    }

    if ('storeyHeightsAboveGround' in options) {
      const parsedStoreyHeightsAboveGround =
        parseStoreyHeights(options.storeyHeightsAboveGround, defaultValues.storeyHeightsAboveGround);
      if (!deepEqual(parsedStoreyHeightsAboveGround, this._storeyHeightsAboveGround)) {
        this._storeyHeightsAboveGround = parsedStoreyHeightsAboveGround;
        changedProperties.push('storeyHeightsAboveGround');
      }
    }

    if ('storeyHeightsBelowGround' in options) {
      const parsedStoreyHeightsBelowGround =
        parseStoreyHeights(options.storeyHeightsBelowGround, defaultValues.storeyHeightsBelowGround);
      if (!deepEqual(parsedStoreyHeightsBelowGround, this._storeyHeightsBelowGround)) {
        this._storeyHeightsBelowGround = parsedStoreyHeightsBelowGround;
        changedProperties.push('storeyHeightsBelowGround');
      }
    }

    if ('storeyHeight' in options) {
      const parsedStoreyHeight = parseNumber(options.storeyHeight, defaultValues.storeyHeight);
      if (parsedStoreyHeight !== this._storeyHeight) {
        getLogger().deprecate('storeyHeight', 'use storeyHeightAboveGround');
        this._storeyHeight = parsedStoreyHeight;
        changedProperties.push('storeyHeight');
      }
    }

    if ('modelUrl' in options) {
      if (options.modelUrl !== this._modelUrl) {
        this._modelUrl = options.modelUrl;
        changedProperties.push('modelUrl');
      }
    }

    if ('modelScaleX' in options) {
      const parsedModelScaleX = parseNumber(options.modelScaleX, defaultValues.modelScaleX);
      if (parsedModelScaleX !== this._modelScaleX) {
        this._modelScaleX = parsedModelScaleX;
        changedProperties.push('modelScaleX');
      }
    }

    if ('modelScaleY' in options) {
      const parsedModelScaleY = parseNumber(options.modelScaleY, defaultValues.modelScaleY);
      if (parsedModelScaleY !== this._modelScaleY) {
        this._modelScaleY = parsedModelScaleY;
        changedProperties.push('modelScaleY');
      }
    }

    if ('modelScaleZ' in options) {
      const parsedModelScaleZ = parseNumber(options.modelScaleZ, defaultValues.modelScaleZ);
      if (parsedModelScaleZ !== this._modelScaleZ) {
        this._modelScaleZ = parsedModelScaleZ;
        changedProperties.push('modelScaleZ');
      }
    }

    if ('modelHeading' in options) {
      const parsedModelHeading = parseNumber(options.modelHeading, defaultValues.modelHeading);
      if (parsedModelHeading !== this._modelHeading) {
        this._modelHeading = parsedModelHeading;
        changedProperties.push('modelHeading');
      }
    }

    if ('modelPitch' in options) {
      const parsedModelPitch = parseNumber(options.modelPitch, defaultValues.modelPitch);
      if (parsedModelPitch !== this._modelPitch) {
        this._modelPitch = parsedModelPitch;
        changedProperties.push('modelPitch');
      }
    }

    if ('modelRoll' in options) {
      const parsedModelRoll = parseNumber(options.modelRoll, defaultValues.modelRoll);
      if (parsedModelRoll !== this._modelRoll) {
        this._modelRoll = parsedModelRoll;
        changedProperties.push('modelRoll');
      }
    }

    if ('baseUrl' in options) {
      if (options.baseUrl !== this._baseUrl) {
        this._baseUrl = options.baseUrl;
        changedProperties.push('baseUrl');
      }
    }

    if (changedProperties.length) {
      this.propertyChanged.raiseEvent(changedProperties);
    }
  }

  /**
   * @returns {VectorPropertiesOptions}
   */
  getValues() {
    /** @type {VectorPropertiesOptions} */
    const values = {
      altitudeMode: getAltitudeModeOptions(this.altitudeMode),
      allowPicking: this.allowPicking,
      classificationType: getClassificationTypeOptions(this.classificationType),
      scaleByDistance: getNearFarValueOptions(this.scaleByDistance),
      eyeOffset: getCartesian3Options(this.eyeOffset),
      heightAboveGround: this.heightAboveGround,
      skirt: this.skirt,
      groundLevel: this.groundLevel,
      extrudedHeight: this.extrudedHeight,
      storeysAboveGround: this.storeysAboveGround,
      storeysBelowGround: this.storeysBelowGround,
      storeyHeightsAboveGround: this.storeyHeightsAboveGround,
      storeyHeightsBelowGround: this.storeyHeightsBelowGround,
      storeyHeight: this.storeyHeight,
      modelUrl: this.modelUrl,
      modelScaleX: this.modelScaleX,
      modelScaleY: this.modelScaleY,
      modelScaleZ: this.modelScaleZ,
      modelHeading: this.modelHeading,
      modelPitch: this.modelPitch,
      modelRoll: this.modelRoll,
      baseUrl: this.baseUrl,
    };
    return values;
  }

  /**
   * @param {VectorPropertiesOptions=} defaultOptions
   * @returns {VcsMeta}
   */
  getVcsMeta(defaultOptions) {
    const defaultValues = defaultOptions || VectorProperties.getDefaultOptions();
    /** @type {VcsMeta} */
    const vcsMeta = {};
    if (getAltitudeModeOptions(this.altitudeMode) !== defaultValues.altitudeMode) {
      vcsMeta.altitudeMode = getAltitudeModeOptions(this.altitudeMode);
    }
    if (this.allowPicking !== defaultValues.allowPicking) {
      vcsMeta.allowPicking = this.allowPicking;
    }
    if (getClassificationTypeOptions(this.classificationType) !== defaultValues.classificationType) {
      vcsMeta.classificationType = getClassificationTypeOptions(this.classificationType);
    }
    if (!deepEqual(getNearFarValueOptions(this.scaleByDistance), defaultValues.scaleByDistance)) {
      vcsMeta.scaleByDistance = getNearFarValueOptions(this.scaleByDistance);
    }
    if (!deepEqual(getCartesian3Options(this.eyeOffset), defaultValues.eyeOffset)) {
      vcsMeta.eyeOffset = getCartesian3Options(this.eyeOffset);
    }
    if (this.heightAboveGround !== defaultValues.heightAboveGround) {
      vcsMeta.heightAboveGround = this.heightAboveGround;
    }
    if (this.skirt !== defaultValues.skirt) {
      vcsMeta.skirt = this.skirt;
    }
    if (this.groundLevel !== defaultValues.groundLevel) {
      vcsMeta.groundLevel = this.groundLevel;
    }
    if (this.extrudedHeight !== defaultValues.extrudedHeight) {
      vcsMeta.extrudedHeight = this.extrudedHeight;
    }
    if (this.storeysAboveGround !== defaultValues.storeysAboveGround) {
      vcsMeta.storeysAboveGround = this.storeysAboveGround;
    }
    if (this.storeysBelowGround !== defaultValues.storeysBelowGround) {
      vcsMeta.storeysBelowGround = this.storeysBelowGround;
    }
    if (!deepEqual(this.storeyHeightsAboveGround, defaultValues.storeyHeightsAboveGround)) {
      vcsMeta.storeyHeightsAboveGround = this.storeyHeightsAboveGround;
    }
    if (!deepEqual(this.storeyHeightsBelowGround, defaultValues.storeyHeightsBelowGround)) {
      vcsMeta.storeyHeightsBelowGround = this.storeyHeightsBelowGround;
    }
    if (this.storeyHeight !== defaultValues.storeyHeight) {
      vcsMeta.storeyHeight = this.storeyHeight;
    }
    if (this.modelUrl !== defaultValues.modelUrl) {
      vcsMeta.modelUrl = this.modelUrl;
    }
    if (this.modelScaleX !== defaultValues.modelScaleX) {
      vcsMeta.modelScaleX = this.modelScaleX;
    }
    if (this.modelScaleY !== defaultValues.modelScaleY) {
      vcsMeta.modelScaleY = this.modelScaleY;
    }
    if (this.modelScaleZ !== defaultValues.modelScaleZ) {
      vcsMeta.modelScaleZ = this.modelScaleZ;
    }
    if (this.modelHeading !== defaultValues.modelHeading) {
      vcsMeta.modelHeading = this.modelHeading;
    }
    if (this.modelPitch !== defaultValues.modelPitch) {
      vcsMeta.modelPitch = this.modelPitch;
    }
    if (this.modelRoll !== defaultValues.modelRoll) {
      vcsMeta.modelRoll = this.modelRoll;
    }
    if (this.baseUrl !== defaultValues.baseUrl) {
      vcsMeta.baseUrl = this.baseUrl;
    }
    return vcsMeta;
  }

  /**
   * destroys the vectorProperties and removes all listeners
   */
  destroy() {
    this.propertyChanged.destroy();
  }
}
export default VectorProperties;
