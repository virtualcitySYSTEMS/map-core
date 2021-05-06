import axios from 'axios';
import Feature from 'ol/Feature.js';
import Cesium3DTileFeature from '@vcmap/cesium/Source/Scene/Cesium3DTileFeature.js';
import Cesium3DTilePointFeature from '@vcmap/cesium/Source/Scene/Cesium3DTilePointFeature.js';
import ImagerySplitDirection from '@vcmap/cesium/Source/Scene/ImagerySplitDirection.js';
import VectorSource from 'ol/source/Vector.js';
import { createEmpty, extend as extendExtent } from 'ol/extent.js';

import Vector from './vector.js';
import { featureStoreStateSymbol, featureStoreState } from './featureStoreState.js';
import { parseGeoJSON } from './geojsonHelpers.js';
import { mercatorProjection } from '../util/projection.js';
import FeatureStoreChanges from './featureStoreChanges.js';
import VectorStyleItem, { defaultVectorStyle, vectorStyleSymbol } from '../util/style/vectorStyleItem.js';
import FeatureVisibility, {
  FeatureVisibilityAction,
  originalStyle,
  synchronizeFeatureVisibility,
  updateOriginalStyle,
} from './featureVisibility.js';
import CesiumTilesetCesium, { getExtentFromTileset } from './cesium/cesiumTilesetCesium.js';
import CesiumMap from '../maps/cesium.js';
import Openlayers from '../maps/openlayers.js';
import Oblique from '../maps/oblique.js';
import CesiumTileset from './cesiumTileset.js';
import VectorProperties from './vectorProperties.js';
import VectorOpenlayers from './openlayers/vectorOpenlayers.js';
import Layer from './layer.js';
import DeclarativeStyleItem from '../util/style/declarativeStyleItem.js';
import VectorOblique from './oblique/vectorOblique.js';
import Extent from '../util/extent.js';
import { isMobile } from '../util/isMobile.js';

/**
 * @typedef {Object} vcs.vcm.layer.FeatureStore.StaticRepresentation
 * @property {string|undefined} threeDim - 3D static representation of this layer
 * @property {string|undefined} twoDim - 2D static representation for this layer
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.FeatureStore.Feature
 * @property {string} id - the mongo id
 * @property {Object} properties - the properties bag
 * @property {Object} geometry
 * @property {Object|undefined} vcsMeta
 * @property {vcs.vcm.layer.FeatureStore.featureStoreState} state
 * @property {string} type - the featureType
 * @todo write vcsMeta for features
 * @todo set type to be one of an enum
 * @api
 */

/**
 * For further details see: {@link http://gitlab/vcsuite/virtualcityMAP/wikis/featureStore/layerSchema}
 * @typedef {vcs.vcm.layer.Vector.Options} vcs.vcm.layer.FeatureStore.LayerSchema
 * @property {string} id - layer mongo id
 * @property {string} type
 * @property {string} featureType
 * @property {vcs.vcm.layer.FeatureStore.StaticRepresentation|undefined} staticRepresentation -  URLs to static representations for 2D and 3D maps
 * @property {Array<string|number>} hiddenStaticFeatureIds -  an array of IDs of features to hide from the static representation
 * @property {Array<vcs.vcm.layer.FeatureStore.Feature>} features - the array of features to represent dynamic features
 * @property {vcs.vcm.layer.VcsMeta} vcsMeta -  vector style implemented by the map and base64-encoded png icons used for custom styles
 * @todo write type enum
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.FeatureStore.LayerSchema} vcs.vcm.layer.FeatureStore.Options
 * @property {Function|undefined} injectedFetchDynamicFeatureFunc - injected function for fetching dynamic features from a remote FeatureStore server
 * @api
 */

/** @type {symbol} */
export const isTiledFeature = Symbol('isTiledFeature');

/**
 * FeatureStore Layer
 * @class
 * @export
 * @extends {vcs.vcm.layer.Vector}
 * @memberOf vcs.vcm.layer
 * @api
 */
class FeatureStore extends Vector {
  static get className() { return 'vcs.vcm.layer.FeatureStore'; }

  /**
   * @returns {vcs.vcm.layer.FeatureStore.Options}
   */
  static getDefaultOptions() {
    return {
      id: '',
      type: 'vcs.vcm.layer.FeatureStore',
      featureType: 'simple',
      features: [],
      ...Vector.getDefaultOptions(),
      projection: mercatorProjection.getConfigObject(),
      staticRepresentation: {},
      hiddenStaticFeatureIds: [],
      vcsMeta: {
        screenSpaceError: 4,
        altitudeMode: 'clampToGround',
      },
    };
  }

  // XXX cant implement getConfigOptions do to non layer options. this will most likely go away in 4.0
  /**
   * @param {vcs.vcm.layer.FeatureStore.Options} options
   */
  constructor(options) {
    const defaultOptions = FeatureStore.getDefaultOptions();
    const vectorOptions = {
      projection: defaultOptions.projection,
      ...options,
    };
    super(vectorOptions);
    this._supportedMaps = [
      CesiumMap.className,
      Openlayers.className,
      Oblique.className,
    ];

    /** @type {string} */
    this.layerId = options.id;

    /** @type {vcs.vcm.layer.FeatureStore.StaticRepresentation} */
    this.staticRepresentation = options.staticRepresentation || defaultOptions.staticRepresentation;

    /** @type {Set<string|number>} */
    this.hiddenStaticFeatureIds = new Set(options.hiddenStaticFeatureIds || defaultOptions.hiddenStaticFeatureIds);

    /**
     * @type {vcs.vcm.layer.FeatureStore.FeatureStoreChanges}
     * @api
     */
    this.changeTracker = new FeatureStoreChanges(this);

    const { vcsMeta } = defaultOptions;
    if (options.vcsMeta) {
      Object.assign(vcsMeta, options.vcsMeta);
    }

    /** @type {vcs.vcm.layer.VcsMeta} */
    this.vcsMeta = vcsMeta;
    this.setVcsMeta(this.vcsMeta);

    /** @type {number} */
    this.screenSpaceErrorMobile = this.vcsMeta.screenSpaceError;
    /** @type {number} */
    this.screenSpaceError = this.vcsMeta.screenSpaceError;

    /**
     * @type {Cesium/Event.RemoveCallback}
     * @private
     */
    this._removeVectorPropertiesChangeHandler = this.vectorProperties.propertyChanged.addEventListener(() => {
      this.changeTracker.values.changed = true;
    });

    /**
     * a function to retrieve a single feature from the server
     * @type {Function|undefined}
     * @returns {Promise}
     * @api
     */
    this.injectedFetchDynamicFeatureFunc = options.injectedFetchDynamicFeatureFunc;
    /**
     * @type {vcs.vcm.layer.FeatureVisibility}
     * @private
     */
    this._staticFeatureVisibility = new FeatureVisibility();
    /**
     * Synchronize featureVisibilities, while maintaining static features hidden.
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilitySyncListeners = [
      synchronizeFeatureVisibility(this.featureVisibility, this._staticFeatureVisibility),
      this._staticFeatureVisibility.changed.addEventListener(({ action }) => {
        if (action === FeatureVisibilityAction.SHOW) {
          this._staticFeatureVisibility.hideObjects([...this.hiddenStaticFeatureIds]);
        }
      }),
    ];

    /**
     * @type {Object|null}
     * @private
     */
    this._setEditing = null;
    /**
     * @type {Promise<void>|null}
     * @private
     */
    this._twoDimLoaded = null;
    /**
     * @type {Function|null}
     * @private
     */
    this._twoDimStyleChanged = null;
    /**
     * @type {ol/source/Vector}
     * @private
     */
    this._twoDimStaticSource = new VectorSource();

    if (options.features) {
      const featureCollection = {
        type: 'FeatureCollection',
        features: options.features,
        vcsMeta: options.vcsMeta,
      };
      const { style, features } = parseGeoJSON(
        featureCollection,
        { targetProjection: mercatorProjection, dynamicStyle: true },
      );
      if (style) {
        this._defaultStyle = style;
        this.setStyle(style);
      }
      this.addFeatures(features);
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this.initialized) {
      return super.initialize()
        .then(() => {
          this._staticFeatureVisibility.hideObjects([...this.hiddenStaticFeatureIds]);
        });
    }
    return super.initialize();
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  _loadTwoDim() {
    if (!this._twoDimLoaded) {
      this._twoDimLoaded = (async () => {
        const { data } = await axios.get(this.staticRepresentation.twoDim);
        const { features } = parseGeoJSON(data, {
          targetProjection: mercatorProjection,
          dynamicStyle: true,
        });
        const isDeclarative = this.style instanceof DeclarativeStyleItem;
        features
          .forEach((feature) => {
            feature[Layer.vcsLayerNameSymbol] = this.name;
            feature[isTiledFeature] = true;
            if (isDeclarative && feature[vectorStyleSymbol]) {
              feature.setStyle();
            }
            if (this._setEditing && this._setEditing.featureType != null) {
              feature[this._setEditing.symbol] = this._setEditing.featureType;
            }
          });
        this._twoDimStaticSource.addFeatures(/** @type {Array<ol/Feature>} */ (features));
      })();
    }
    return this._twoDimLoaded;
  }

  /**
   * @returns {vcs.vcm.layer.Vector.ImplementationOptions}
   * @private
   */
  _getTwoDimStaticImplOptions() {
    return {
      ...super.getImplementationOptions(),
      source: this._twoDimStaticSource,
      featureVisibility: this._staticFeatureVisibility,
    };
  }

  /**
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.oblique.VectorOblique|vcs.vcm.layer.cesium.VectorCesium|vcs.vcm.layer.openlayers.VectorOpenlayers|vcs.vcm.layer.cesium.CesiumTilesetCesium>}
   */
  // @ts-ignore
  createImplementationsForMap(map) {
    const impls = /** @type {Array<vcs.vcm.layer.LayerImplementation>} */ (super.createImplementationsForMap(map));
    if (map instanceof CesiumMap && this.staticRepresentation && this.staticRepresentation.threeDim) {
      impls.push(new CesiumTilesetCesium(map, /** @type {vcs.vcm.layer.CesiumTileset.ImplementationOptions} */ ({
        url: this.staticRepresentation.threeDim,
        tilesetOptions: {
          maximumScreenSpaceError: isMobile() ? this.screenSpaceErrorMobile : this.screenSpaceError,
          url: this.staticRepresentation.threeDim,
        },
        tilesetProperties: [
          {
            key: isTiledFeature,
            value: true,
          },
        ],
        name: this.name,
        style: this.style,
        featureVisibility: this._staticFeatureVisibility,
        splitDirection: ImagerySplitDirection.NONE,
        jumpToLocation: false,
      })));
    } else if (this.staticRepresentation && this.staticRepresentation.twoDim) {
      this._loadTwoDim();
      if (map instanceof Openlayers) {
        impls.push(new VectorOpenlayers(map, this._getTwoDimStaticImplOptions()));
      } else if (map instanceof Oblique) {
        impls.push(new VectorOblique(map, this._getTwoDimStaticImplOptions()));
      }
    }
    // eslint-disable-next-line max-len
    return /** @type {Array<vcs.vcm.layer.oblique.VectorOblique|vcs.vcm.layer.cesium.VectorCesium|vcs.vcm.layer.openlayers.VectorOpenlayers|vcs.vcm.layer.cesium.CesiumTilesetCesium>} */ (impls);
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  reload() {
    this._twoDimLoaded = null;
    this._twoDimStaticSource.clear();
    return super.reload();
  }

  /**
   * @inheritDoc
   * @returns {Promise}
   * @api
   */
  async activate() {
    await super.activate();
    if (this.active && this._setEditing) {
      this.setEditing(this._setEditing.symbol, this._setEditing.featureType);
    }
  }

  /**
   * @protected
   */
  _trackStyleChanges() {
    super._trackStyleChanges();
    if (this.staticRepresentation.twoDim) {
      if (this._twoDimStyleChanged) {
        this._twoDimStyleChanged();
        this._twoDimStyleChanged = null;
      }

      const isDeclarative = this.style instanceof DeclarativeStyleItem;
      this._twoDimStyleChanged = this.style.styleChanged.addEventListener(() => {
        this._twoDimStaticSource.getFeatures().forEach((f) => {
          if (isDeclarative || !f[vectorStyleSymbol]) {
            f.changed();
          }
        });
      });
    }
  }

  /**
   * @inheritDoc
   * @param {string|ol/style/Style|ol/style/StyleFunction|vcs.vcm.util.style.StyleItem} style
   * @param {boolean=} silent
   * @api
   */
  setStyle(style, silent) {
    const changeTrackerActive = this.changeTracker.active;
    if (changeTrackerActive) {
      this.changeTracker.pauseTracking('changefeature');
    }
    super.setStyle(style, silent);
    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this._twoDimStaticSource.getFeatures().forEach((f) => {
      if (f[vectorStyleSymbol]) {
        let changed;
        if (isDeclarative) {
          changed = true;
          f.setStyle(undefined);
        } else if (f.getStyle() !== f[vectorStyleSymbol].style) {
          changed = true;
          f.setStyle(f[vectorStyleSymbol].style);
        }
        if (changed && Reflect.has(f, originalStyle)) {
          updateOriginalStyle(f);
        }
      }
    });
    if (changeTrackerActive) {
      this.changeTracker.track();
      this.changeTracker.values.changed = true;
    }
  }

  /**
   * @param {symbol} symbol
   * @param {vcs.vcm.util.editor.FeatureType=} featureType
   */
  setEditing(symbol, featureType) {
    this.getImplementations().forEach((impl) => {
      if (impl instanceof CesiumTilesetCesium) {
        if (impl.initialized) {
          if (featureType != null) {
            impl.cesium3DTileset[symbol] = featureType;
          } else {
            delete impl.cesium3DTileset[symbol];
          }
          this._setEditing = null;
        } else {
          this._setEditing = { symbol, featureType };
        }
      }
    });

    if (this.staticRepresentation.twoDim) {
      if (this._twoDimLoaded) {
        this._twoDimLoaded.then(() => {
          this._twoDimStaticSource.getFeatures()
            .forEach((f) => {
              if (featureType != null) {
                f[symbol] = featureType;
              } else {
                delete f[symbol];
              }
            });
        });
      } else {
        this._setEditing = { symbol, featureType };
      }
    }
  }

  /**
   * @param {Object|ol/Feature|Cesium/Cesium3DTilePointFeature|Cesium/Cesium3DTileFeature} feature
   * @returns {?Object}
   */
  objectClickedHandler(feature) {
    if ((feature instanceof Cesium3DTileFeature || feature instanceof Cesium3DTilePointFeature)) {
      return CesiumTileset.prototype.objectClickedHandler.call(this, feature);
    } else if (feature instanceof Feature) {
      return super.objectClickedHandler(feature);
    }
    return null;
  }

  /**
   * @param {Object|vcs.vcm.layer.Vector.ClickedObject} object
   * @returns {vcs.vcm.layer.GenericFeature}
   */
  getGenericFeatureFromClickedObject(object) {
    if (object instanceof Feature) {
      // @ts-ignore
      return super.getGenericFeatureFromClickedObject(/** @type {vcs.vcm.layer.Vector.ClickedObject} */ (object));
    }
    const generic = CesiumTileset.prototype.getGenericFeatureFromClickedObject.call(this, object);
    generic.layerName = this.name;
    generic.layerClass = this.className;
    return generic;
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.util.Extent|null}
   * @api
   */
  getZoomToExtent() {
    if (this.extent && this.extent.isValid()) {
      return this.extent;
    }
    const extent = super.getZoomToExtent();
    const mercatorExtent = extent ? extent.getCoordinatesInProjection(mercatorProjection) : createEmpty();
    if (this.staticRepresentation.threeDim) {
      const threeDImpl = /** @type {vcs.vcm.layer.cesium.CesiumTilesetCesium} */ (this.getImplementations()
        .find((impl) => {
          return impl instanceof CesiumTilesetCesium && impl.cesium3DTileset;
        }));

      if (threeDImpl) {
        const threeDimExtent = getExtentFromTileset(threeDImpl.cesium3DTileset);
        extendExtent(mercatorExtent, threeDimExtent);
      }
    }

    if (this.staticRepresentation.twoDim && this._twoDimLoaded) {
      extendExtent(mercatorExtent, this._twoDimStaticSource.getExtent());
    }

    const actualExtent = new Extent({
      ...mercatorProjection.getConfigObject(),
      coordinates: mercatorExtent,
    });

    if (actualExtent.isValid()) {
      return actualExtent;
    }

    return null;
  }

  /**
   * set the maximum screen space error of this layer
   * @param {number} value
   * @api stable
   */
  setMaximumScreenSpaceError(value) {
    if (isMobile()) {
      this.screenSpaceErrorMobile = value;
    } else {
      this.screenSpaceError = value;
    }

    this.getImplementations()
      .forEach((impl) => {
        if (impl instanceof CesiumTilesetCesium && impl.cesium3DTileset) {
          impl.cesium3DTileset.maximumScreenSpaceError = value;
        }
      });
  }

  /**
   * switch an array of static features to dynamic features
   * This is done by hiding the static features and adding their dynamic counterparts to the FeatureStore layer
   * @param {string|number} [featureId] input static feature ID
   * @returns {Promise<ol/Feature>}
   * @api
   */
  switchStaticFeatureToDynamic(featureId) {
    if (this.hiddenStaticFeatureIds.has(featureId)) {
      return Promise.resolve(this.getFeatureById(featureId));
    }
    if (this.injectedFetchDynamicFeatureFunc) {
      return this.injectedFetchDynamicFeatureFunc(featureId)
        .then((result) => {
          const { features } = parseGeoJSON(
            result,
            {
              targetProjection: mercatorProjection,
              defaultStyle: this.defaultStyle instanceof VectorStyleItem ?
                this.defaultStyle :
                defaultVectorStyle,
            },
          );
          this._staticFeatureVisibility.hideObjects([featureId]);
          this.hiddenStaticFeatureIds.add(featureId);
          this.addFeatures(features);
          return features[0];
        })
        .catch((err) => {
          this.getLogger().error(err.message);
        });
    }
    return Promise.reject(new Error('no injected fetching function'));
  }

  /**
   * removes a static feature from featureStore layer
   * @param {string} featureId
   * @api
   */
  removeStaticFeature(featureId) {
    this._staticFeatureVisibility.hideObjects([featureId]);
    this.hiddenStaticFeatureIds.add(featureId);
    const feature = new Feature();
    feature.setId(featureId);
    feature[featureStoreStateSymbol] = featureStoreState.STATIC;
    this.changeTracker.removeFeature(feature);
  }

  /**
   * Resets a feature which used to be static but is now dynamic. called from featureStoreChanges API.
   * @param {string|number} featureId
   */
  resetStaticFeature(featureId) {
    if (this.hiddenStaticFeatureIds.has(featureId)) {
      const idArray = [featureId];
      this.removeFeaturesById(idArray);
      this.hiddenStaticFeatureIds.delete(featureId);
      if (!this.featureVisibility.hiddenObjects[featureId]) {
        this._staticFeatureVisibility.showObjects(idArray);
      }
    }
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.FeatureStore.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.FeatureStore.Options} */ (super.getConfigObject());
    const defaultOptions = FeatureStore.getDefaultOptions();

    delete config.projection;
    config.vcsMeta = this.vectorProperties
      .getVcsMeta({ ...VectorProperties.getDefaultOptions(), ...defaultOptions.vcsMeta });
    if (Object.keys(config.vcsMeta).length === 0) {
      delete config.vcsMeta;
    }

    if (this.vcsMeta.screenSpaceError !== defaultOptions.vcsMeta.screenSpaceError) {
      config.vcsMeta = config.vcsMeta || {};
      config.vcsMeta.screenSpaceError = this.vcsMeta.screenSpaceError;
    }

    if (Object.keys(this.staticRepresentation).length > 0) {
      config.staticRepresentation = { ...this.staticRepresentation };
    }

    if (this.hiddenStaticFeatureIds.size > 0) {
      config.hiddenStaticFeatureIds = [...this.hiddenStaticFeatureIds];
    }
    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.removeAllFeatures();
    this._twoDimStaticSource.clear();
    if (this._twoDimStyleChanged) {
      this._twoDimStyleChanged();
      this._twoDimStyleChanged = null;
    }
    this._featureVisibilitySyncListeners.forEach((cb) => { cb(); });
    this._featureVisibilitySyncListeners = [];
    this._staticFeatureVisibility.destroy();
    this.changeTracker.destroy();
    if (this._removeVectorPropertiesChangeHandler) {
      this._removeVectorPropertiesChangeHandler();
    }
    super.destroy();
  }
}

export default FeatureStore;
