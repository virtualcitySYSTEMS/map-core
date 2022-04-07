import Style from 'ol/style/Style.js';
import { parseInteger } from '@vcsuite/parsers';
import CesiumMap from '../map/cesiumMap.js';
import VectorRasterTileCesiumImpl from './cesium/vectorRasterTileCesiumImpl.js';
import OpenlayersMap from '../map/openlayersMap.js';
import VectorTileOpenlayersImpl from './openlayers/vectorTileOpenlayersImpl.js';
import FeatureLayer from './featureLayer.js';
import VectorStyleItem, { defaultVectorStyle } from '../style/vectorStyleItem.js';
import VectorProperties from './vectorProperties.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import { FeatureVisibilityAction, globalHidden, hidden, highlighted } from './featureVisibility.js';
import { getStylesArray } from '../util/featureconverter/convert.js';
import { vcsLayerName } from './layerSymbols.js';
import TileProviderFeatureProvider from '../featureProvider/tileProviderFeatureProvider.js';
import { getGenericFeatureFromClickedObject } from './vectorHelpers.js';
import { originalFeatureSymbol } from './vectorSymbols.js';
import { getObjectFromClassRegistry, layerClassRegistry, tileProviderClassRegistry } from '../classRegistry.js';
import TileProvider from './tileProvider/tileProvider.js';

/**
 * synchronizes featureVisibility Symbols on the feature;
 * @param {import("@vcmap/core").FeatureVisibility} featureVisibility
 * @param {import("@vcmap/core").GlobalHider} globalHider
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 */
function synchronizeFeatureVisibility(featureVisibility, globalHider, feature) {
  const featureId = feature.getId();
  if (featureVisibility.hiddenObjects[featureId]) {
    feature[hidden] = true;
  } else if (feature[hidden]) {
    delete feature[hidden];
  }
  if (featureVisibility.highlightedObjects[featureId]) {
    feature[highlighted] = featureVisibility.highlightedObjects[featureId].style;
  } else if (feature[highlighted]) {
    delete feature[highlighted];
  }
  if (globalHider.hiddenObjects[featureId]) {
    feature[globalHidden] = true;
  } else if (feature[globalHidden]) {
    delete feature[globalHidden];
  }
}

/**
 * @typedef {FeatureLayerOptions} VectorTileOptions
 * @property {TileProviderOptions|import("@vcmap/core").TileProvider} tileProvider
 * @property {VectorStyleItemOptions|import("@vcmap/core").VectorStyleItem|undefined} highlightStyle
 * @property {VectorPropertiesOptions|undefined} vectorProperties
 * @property {number|undefined} minLevel used to restrict the zoom level visibility (minlevel does not allow rendering above tileProvider baseLevel)
 * @property {number|undefined} maxLevel used to restrict the zoom level visibility
 * @api
 */

/**
 * @typedef {FeatureLayerImplementationOptions} VectorTileImplementationOptions
 * @property {import("@vcmap/core").TileProvider} tileProvider
 * @property {import("ol/size").Size} tileSize
 * @property {number} minLevel
 * @property {number} maxLevel
 * @property {import("@vcmap/core").Extent|undefined} extent
 */

/**
 * @typedef {FeatureLayerImplementation} VectorTileImplementation
 * @property {function(Array<string>):void} updateTiles
 */

/**
 * VectorTileLayer Layer for tiled vector Data. Can be connected to data with a TileProvider
 * @class
 * @export
 * @extends {FeatureLayer}
 * @api stable
 */
class VectorTileLayer extends FeatureLayer {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'VectorTileLayer'; }

  /**
   * @returns {VectorTileOptions}
   */
  static getDefaultOptions() {
    return {
      ...FeatureLayer.getDefaultOptions(),
      tileProvider: undefined,
      highlightStyle: undefined,
      vectorProperties: {},
      minLevel: undefined,
      maxLevel: undefined,
    };
  }


  /**
   * @param {VectorTileOptions} options
   */
  constructor(options) {
    super(options);

    this._supportedMaps = [
      CesiumMap.className,
      OpenlayersMap.className,
    ];

    const defaultOptions = VectorTileLayer.getDefaultOptions();

    /** @type {VectorStyleItem} */
    this.highlightStyle = /** @type {undefined} */ (defaultOptions.highlightStyle);
    if (options.highlightStyle) {
      this.highlightStyle = options.highlightStyle instanceof VectorStyleItem ?
        options.highlightStyle :
        new VectorStyleItem(options.highlightStyle);
    }

    /**
     * @type {import("ol/size").Size}
     * @private
     */
    this._tileSize = [256, 256];

    /**
     * at the moment only used for allowPicking, triggers a reload on change
     * @type {VectorProperties}
     * @api
     */
    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    /**
     * @type {import("@vcmap/core").TileProvider}
     * @api
     */
    this.tileProvider = options.tileProvider instanceof TileProvider ? // XXX this now throws if not passing in a tileProvider.
      options.tileProvider :
      getObjectFromClassRegistry(tileProviderClassRegistry, options.tileProvider);

    /**
     * @type {number|undefined}
     * @private
     */
    this._maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);

    /**
     * @type {number|undefined}
     * @private
     */
    this._minLevel = parseInteger(options.minLevel, defaultOptions.minLevel);

    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListener = [];

    /**
     * @type {Function}
     * @private
     */
    this._tileLoadEventListener = () => {};

    /**
     * @type {Function}
     * @private
     */
    this._vectorPropertiesChangedListener = () => {};

    /**
     * zIndex for features with featureStyle // Do we maybe need a global counter ?
     * @type {number}
     * @private
     */
    this._styleZIndex = 0;
  }

  /**
   * initializes the layer, can be used to defer loading
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this._tileLoadEventListener =
        this.tileProvider.tileLoadedEvent.addEventListener(event => this._handleTileLoaded(event));
      this._vectorPropertiesChangedListener =
        this.vectorProperties.propertyChanged.addEventListener(() => {
          this.reload();
        });
      this.featureProvider = new TileProviderFeatureProvider(this.name, { // XXX this overwrites
        tileProvider: this.tileProvider,
        vectorProperties: this.vectorProperties,
      });
    }
    await super.initialize();
  }


  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} olFeature
   * @returns {?Object}
   */
  objectClickedHandler(olFeature) {
    const actualFeature = olFeature[originalFeatureSymbol] || olFeature;
    if (this.vectorProperties.getAllowPicking(actualFeature)) {
      if (olFeature[hidden] || olFeature[globalHidden]) {
        return null;
      }
      return {
        id: actualFeature.getId(),
        feature: actualFeature,
      };
    }
    return null;
  }

  /**
   * @param {VectorClickedObject} object
   * @returns {?GenericFeature}
   */
  getGenericFeatureFromClickedObject(object) {
    return getGenericFeatureFromClickedObject(object, this);
  }

  /**
   * @returns {number}
   * @private
   */
  _getNextStyleZIndex() {
    this._styleZIndex += 1;
    return this._styleZIndex;
  }

  /**
   * @param {TileLoadedEvent} event
   * @private
   */
  _handleTileLoaded({ rtree }) {
    rtree.all().map(item => item.value).forEach((feature) => {
      const featureStyle = /** @type {import("ol/style/Style").default} */ (feature.getStyle());
      if (featureStyle && featureStyle instanceof Style) {
        featureStyle.setZIndex(this._getNextStyleZIndex());
      }
      feature[vcsLayerName] = this.name;
      feature.getStyleFunction = () => {
        return this._featureStyle.bind(this);
      };
      if (this.tileProvider.trackFeaturesToTiles) {
        synchronizeFeatureVisibility(this.featureVisibility, this.globalHider, feature);
      }
    });
  }

  /**
   *
   * @returns {Array<Function>}
   * @private
   */
  _setupFeatureVisibilityHandlers() {
    if (!this.tileProvider.trackFeaturesToTiles) {
      return [];
    }
    return [
      this.featureVisibility.changed.addEventListener(({ action, ids }) => {
        const tileIdsChanged = new Set();
        ids.forEach((id) => {
          const tileIds = this.tileProvider.featureIdToTileIds.get(id);
          if (tileIds) {
            tileIds.forEach((tileId) => {
              const rtree = this.tileProvider.rtreeCache.get(tileId);
              const tileProviderRTreeEntry = rtree.all().find(item => item.value.getId() === id);
              if (tileProviderRTreeEntry) {
                const feature = tileProviderRTreeEntry.value;
                tileIdsChanged.add(tileId);
                if (action === FeatureVisibilityAction.HIGHLIGHT) {
                  feature[highlighted] = this.featureVisibility.highlightedObjects[id].style;
                } else if (action === FeatureVisibilityAction.UNHIGHLIGHT) {
                  delete feature[highlighted];
                } else if (action === FeatureVisibilityAction.HIDE) {
                  feature[hidden] = true;
                } else if (action === FeatureVisibilityAction.SHOW) {
                  delete feature[hidden];
                }
              }
            });
          }
        });
        this.updateTiles([...tileIdsChanged]);
      }),

      this.globalHider.changed.addEventListener(({ action, ids }) => {
        const tileIdsChanged = new Set();
        ids.forEach((id) => {
          const tileIds = this.tileProvider.featureIdToTileIds.get(id);
          if (tileIds) {
            tileIds.forEach((tileId) => {
              const rtree = this.tileProvider.rtreeCache.get(tileId);
              const tileProviderRTreeEntry = rtree.all().find(item => item.value.getId() === id);
              if (tileProviderRTreeEntry) {
                const feature = tileProviderRTreeEntry.value;
                tileIdsChanged.add(tileId);
                if (action === FeatureVisibilityAction.HIDE) {
                  feature[globalHidden] = true;
                } else if (action === FeatureVisibilityAction.SHOW) {
                  delete feature[globalHidden];
                }
              }
            });
          }
        });
        this.updateTiles([...tileIdsChanged]);
      }),
    ];
  }

  /**
   * rerenders the specified tiles
   * rendering happens async
   * @param {Array<string>} tileIds
   * @api
   */
  updateTiles(tileIds) {
    this.getImplementations()
      .forEach((impl) => {
        /** @type {VectorTileImplementation} */ (impl).updateTiles(tileIds);
      });
  }

  /**
   * calculates the style the feature has to be rendered
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @param {number} resolution
   * @returns {Array<import("ol/style/Style").default>}
   * @private
   */
  _featureStyle(feature, resolution) {
    let style;
    if (feature[hidden] || feature[globalHidden]) {
      return [];
    }
    if (feature[highlighted]) { // priority highlighted features
      ({ style } = feature[highlighted]);
    } else if (this.style instanceof DeclarativeStyleItem) { // if declarative use layerStyle
      ({ style } = this.style);
    } else { // if vectorStyle use featureStyle
      style = feature.getStyle() || this.style.style;
    }
    return getStylesArray(style, feature, resolution);
  }

  /**
   * @returns {VectorTileImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      tileProvider: this.tileProvider,
      tileSize: this._tileSize,
      minLevel: this._minLevel,
      maxLevel: this._maxLevel,
      extent: this.extent,
    };
  }


  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<VectorRasterTileCesiumImpl|VectorTileOpenlayersImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new VectorRasterTileCesiumImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof OpenlayersMap) {
      return [
        new VectorTileOpenlayersImpl(map, this.getImplementationOptions()),
      ];
    }

    return [];
  }

  /**
   * @param {(DeclarativeStyleItemOptions|VectorStyleItemOptions|import("@vcmap/core").StyleItem)=} styleOptions
   * @param {VectorStyleItem=} defaultStyle
   * @returns {import("@vcmap/core").StyleItem}
   */
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return super.getStyleOrDefaultStyle(styleOptions, defaultStyle || defaultVectorStyle.clone());
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   * @api stable
   */
  async activate() {
    await super.activate();
    this._featureVisibilityListener = this._setupFeatureVisibilityHandlers();
    if (this.tileProvider.trackFeaturesToTiles) {
      this.tileProvider.forEachFeature((feature) => {
        synchronizeFeatureVisibility(this.featureVisibility, this.globalHider, feature);
      });
    }
  }

  /**
   * @inheritDoc
   * @api
   */
  deactivate() {
    super.deactivate();
    this._featureVisibilityListener.forEach((cb) => { cb(); });
  }

  /**
   * @inheritDoc
   * @api
   */
  destroy() {
    this._featureVisibilityListener.forEach((cb) => { cb(); });
    super.destroy();
    this._tileLoadEventListener();
    if (this.featureProvider) {
      this.featureProvider.destroy();
    }
    if (this.tileProvider) {
      this.tileProvider.destroy();
    }
    this._vectorPropertiesChangedListener();
    if (this.vectorProperties) {
      this.vectorProperties.destroy();
    }
  }

  /**
   * @inheritDoc
   * @returns {VectorTileOptions}
   */
  toJSON() {
    const config = /** @type {VectorTileOptions} */ (super.toJSON());
    const defaultOptions = VectorTileLayer.getDefaultOptions();

    if (this._maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this._maxLevel;
    }

    if (this._minLevel !== defaultOptions.minLevel) {
      config.minLevel = this._minLevel;
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta();
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    if (this.tileProvider) {
      config.tileProvider = this.tileProvider.toJSON();
    }

    return config;
  }
}

layerClassRegistry.registerClass(VectorTileLayer.className, VectorTileLayer);
export default VectorTileLayer;
