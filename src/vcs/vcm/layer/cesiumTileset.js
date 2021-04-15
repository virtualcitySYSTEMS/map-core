import ImagerySplitDirection from 'cesium/Source/Scene/ImagerySplitDirection.js';
import Matrix4 from 'cesium/Source/Core/Matrix4.js';

import { checkMaybe } from '@vcs/check';
import { parseInteger } from '@vcs/parsers';
import getJSONObjectFromObject from './cesium/x3dmHelper.js';
import VectorStyleItem from '../util/style/vectorStyleItem.js';
import FeatureLayer from './featureLayer.js';
import CesiumTilesetCesium, { getExtentFromTileset } from './cesium/cesiumTilesetCesium.js';
import CesiumMap from '../maps/cesium.js';
import VcsEvent from '../event/vcsEvent.js';
import Extent from '../util/extent.js';
import { mercatorProjection } from '../util/projection.js';
import { isMobile } from '../util/isMobile.js';
import { referenceableStyleSymbol } from '../util/style/styleItem.js';

/**
 * @typedef {vcs.vcm.layer.Layer.Options} vcs.vcm.layer.CesiumTileset.Options
 * @property {number|undefined} [screenSpaceError=16] -  relates inversely to the depth over which the layer is activated
 * @property {number|undefined} [screenSpaceErrorMobile=32] -  relates inversely to the depth over which the layer is activated
 * @property {number|undefined} [maximumMemoryUsage=16] - sets the cesium maximumMemoryUsage Parameter (Is when the cached tiles exceed this value cesium starts to clear the cached tiles)
 * @property {Object|undefined} tilesetOptions
 * @property {vcs.vcm.util.style.VectorStyleItem|vcs.vcm.util.style.VectorStyleItem.Options|undefined} highlightStyle
 * @property {vcs.vcm.layer.FeatureVisibility|undefined} featureVisibility
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied
 * @property {ol/Coordinate|undefined} offset - an offset of x, y, z. x and y in degrees longitude/latitude respectively
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.CesiumTileset.TilesetProperties
 * @property {string|symbol} key
 * @property {*} value
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.FeatureLayer.ImplementationOptions} vcs.vcm.layer.CesiumTileset.ImplementationOptions
 * @property {Object|undefined} tilesetOptions
 * @property {Cesium/ImagerySplitDirection} splitDirection
 * @property {Array<vcs.vcm.layer.CesiumTileset.TilesetProperties>|undefined} tilesetProperties
 * @property {Cesium/Matrix4|undefined} modelMatrix
 * @property {ol/Coordinate|undefined} offset
 * @api
 */

/**
 * represents a specific Building layer for cesium.
 * @class
 * @extends {vcs.vcm.layer.FeatureLayer}
 * @implements {vcs.vcm.layer.SplitLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 * @export
 */
class CesiumTileset extends FeatureLayer {
  /** @type {string} */
  static get className() { return 'vcs.vcm.layer.CesiumTileset'; }

  /**
   * @returns {vcs.vcm.layer.CesiumTileset.Options}
   */
  static getDefaultOptions() {
    return {
      ...FeatureLayer.getDefaultOptions(),
      highlightStyle: undefined,
      screenSpaceError: 16,
      screenSpaceErrorMobile: 32,
      maximumMemoryUsage: 16,
      tilesetOptions: {},
      splitDirection: undefined,
      offset: undefined,
    };
  }

  /**
   * @param {vcs.vcm.layer.CesiumTileset.Options} options
   */
  constructor(options) {
    super(options);
    this._supportedMaps = [
      CesiumMap.className,
    ];
    const defaultOptions = CesiumTileset.getDefaultOptions();
    if (this.url && !/\.json$/.test(this.url)) {
      this.url = `${this.url.replace(/\/$/, '')}/tileset.json`;
    }

    /** @type {vcs.vcm.util.style.VectorStyleItem} */
    this.highlightStyle = null;
    if (options.highlightStyle) {
      this.highlightStyle = options.highlightStyle instanceof VectorStyleItem ?
        options.highlightStyle :
        new VectorStyleItem(/** @type {vcs.vcm.util.style.VectorStyleItem.Options} */ (options.highlightStyle));
    }
    /** @type {number} */
    this.screenSpaceError = parseInteger(options.screenSpaceError, defaultOptions.screenSpaceError);

    /** @type {number} */
    this.screenSpaceErrorMobile = parseInteger(options.screenSpaceErrorMobile, defaultOptions.screenSpaceErrorMobile);

    /** @type {number} */
    this.maximumMemoryUsage = parseInteger(options.maximumMemoryUsage, defaultOptions.maximumMemoryUsage);

    const tilesetOptions = options.tilesetOptions || defaultOptions.tilesetOptions;

    /** @type {!Object} */
    this.tilesetOptions = {
      url: this.url,
      maximumScreenSpaceError: isMobile() ? this.screenSpaceErrorMobile : this.screenSpaceError,
      maximumMemoryUsage: this.maximumMemoryUsage,
      ...tilesetOptions,
    };

    /** @type {Cesium/ImagerySplitDirection} */
    this._splitDirection = ImagerySplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        ImagerySplitDirection.LEFT :
        ImagerySplitDirection.RIGHT;
    }

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {vcs.vcm.event.VcsEvent<Cesium/ImagerySplitDirection>}
     * @api
     */
    this.splitDirectionChanged = new VcsEvent();

    /**
     * @type {Cesium/Matrix4|undefined}
     * @private
     */
    this._modelMatrix = undefined;

    /**
     * @type {ol/Coordinate|undefined}
     * @private
     */
    this._offset = options.offset || defaultOptions.offset;
  }

  /**
   * A model matrix to apply to each cesium3DTileset created from this layer.
   * This will overwrite any modelMatrix calculated by the offset property.
   * @api
   * @returns {Cesium/Matrix4|undefined}
   */
  get modelMatrix() {
    return this._modelMatrix;
  }

  /**
   * @param {Cesium/Matrix4|undefined} modelMatrix
   */
  set modelMatrix(modelMatrix) {
    checkMaybe(modelMatrix, Matrix4);

    this._modelMatrix = modelMatrix;
    this.getImplementations()
      .forEach(/** @param {vcs.vcm.layer.cesium.CesiumTilesetCesium} impl */ (impl) => {
        impl.updateModelMatrix(modelMatrix);
      });
  }

  /**
   * An offset in x, y, z. x and y are in degrees longitude latitude respectively.
   * If a modelMatrix is defined on this layer, setting an offset will not take effect until you
   * set the modelMatrix to undefined.
   * @api
   * @type {ol/Coordinate|undefined}
   */
  get offset() {
    return this._offset;
  }

  /**
   * @param {ol/Coordinate|undefined} offset
   */
  set offset(offset) {
    checkMaybe(offset, [Number]);

    this._offset = offset;
    this.getImplementations()
      .forEach(/** @param {vcs.vcm.layer.cesium.CesiumTilesetCesium} impl */ (impl) => {
        impl.updateOffset(offset);
      });
  }

  /**
   * @api
   * @type {Cesium/ImagerySplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {Cesium/ImagerySplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this.getImplementations().forEach((impl) => {
        /** @type {vcs.vcm.layer.cesium.CesiumTilesetCesium} */ (impl).updateSplitDirection(direction);
      });
      this._splitDirection = direction;
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.CesiumTileset.ImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      tilesetOptions: this.tilesetOptions,
      splitDirection: this.splitDirection,
      modelMatrix: this.modelMatrix,
      offset: this.offset,
    };
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.cesium.CesiumTilesetCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new CesiumTilesetCesium(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @param {Cesium/Cesium3DTileFeature|Cesium/Cesium3DTilePointFeature} object
   * @returns {?Object}
   */
  objectClickedHandler(object) {
    if (this.allowPicking) {
      const jsonObject = getJSONObjectFromObject(object);
      if (jsonObject) {
        return {
          id: jsonObject.id,
          feature: jsonObject,
        };
      }
    }
    return null;
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on tileset.
   * Returns null of no extent was configured and the layers tileset is not yet loaded or ready.
   * @returns {vcs.vcm.util.Extent|null}
   * @api
   */
  getZoomToExtent() {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }
    const impl = /** @type {vcs.vcm.layer.cesium.CesiumTilesetCesium} */ (this.getImplementations()[0]);
    if (impl) {
      const threeDimExtent = getExtentFromTileset(impl.cesium3DTileset);

      const actualExtent = new Extent({
        ...mercatorProjection.getConfigObject(),
        coordinates: threeDimExtent,
      });

      if (actualExtent.isValid()) {
        return actualExtent;
      }
    }

    return null;
  }

  // TODO type params
  getGenericFeatureFromClickedObject(object) {
    const attributes = { ...this.genericFeatureProperties, ...object.attributes || object };
    return {
      layerName: this.name,
      layerClass: this.className,
      attributes,
      longitude: object.clickedPosition.longitude,
      latitude: object.clickedPosition.latitude,
      height: object.clickedPosition.height + this.balloonHeightOffset,
      relativeToGround: false,
    };
  }

  /**
   * set the maximum screenspace error of this layer
   * @param {number} value
   * @api stable
   */
  setMaximumScreenSpaceError(value) {
    this.getImplementations()
      .forEach(/** @param {vcs.vcm.layer.cesium.CesiumTilesetCesium} impl */(impl) => {
        if (impl.cesium3DTileset) {
          impl.cesium3DTileset.maximumScreenSpaceError = value;
        }
      });
  }

  /**
   * @returns {vcs.vcm.layer.CesiumTileset.Options}
   */
  getConfigObject() {
    /** @type {vcs.vcm.layer.CesiumTileset.Options} */
    const config = super.getConfigObject();
    const defaultOptions = CesiumTileset.getDefaultOptions();
    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle[referenceableStyleSymbol] ?
        this.highlightStyle.getReference() :
        this.highlightStyle.getOptions();
    }

    if (this.screenSpaceError !== defaultOptions.screenSpaceError) {
      config.screenSpaceError = this.screenSpaceError;
    }

    if (this.screenSpaceErrorMobile !== defaultOptions.screenSpaceErrorMobile) {
      config.screenSpaceErrorMobile = this.screenSpaceErrorMobile;
    }

    if (this.maximumMemoryUsage !== defaultOptions.maximumMemoryUsage) {
      config.maximumMemoryUsage = this.maximumMemoryUsage;
    }

    const tilesetOptions = { ...this.tilesetOptions };
    if (tilesetOptions.url === this.url) {
      delete tilesetOptions.url;
    }

    const usedScreenSpaceError = isMobile() ? this.screenSpaceErrorMobile : this.screenSpaceError;
    if (tilesetOptions.maximumScreenSpaceError === usedScreenSpaceError) {
      delete tilesetOptions.maximumScreenSpaceError;
    }

    if (tilesetOptions.maximumMemoryUsage === this.maximumMemoryUsage) {
      delete tilesetOptions.maximumMemoryUsage;
    }

    if (Object.keys(tilesetOptions).length > 0) {
      config.tilesetOptions = tilesetOptions;
    }

    if (this._splitDirection !== ImagerySplitDirection.NONE) {
      config.splitDirection = this._splitDirection === ImagerySplitDirection.RIGHT ?
        'right' :
        'left';
    }

    if (Array.isArray(this.offset)) {
      config.offset = this.offset.slice();
    }

    return config;
  }

  /**
   * disposes of this layer, removes instances from the current maps and the framework
   * @api stable
   */
  destroy() {
    super.destroy();
    this.splitDirectionChanged.destroy();
  }
}

export default CesiumTileset;
