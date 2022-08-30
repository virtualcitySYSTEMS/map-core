import Style from 'ol/style/Style.js';
import { parseInteger } from '@vcsuite/parsers';
import CesiumMap from '../maps/cesium.js';
import VectorRasterTileCesium from './cesium/vectorRasterTileCesium.js';
import Openlayers from '../maps/openlayers.js';
import VectorTileOpenlayers from './openlayers/vectorTileOpenlayers.js';
import FeatureLayer from './featureLayer.js';
import VectorStyleItem, { defaultVectorStyle } from '../util/style/vectorStyleItem.js';
import VectorProperties from './vectorProperties.js';
import DeclarativeStyleItem from '../util/style/declarativeStyleItem.js';
import { FeatureVisibilityAction, globalHidden, hidden, highlighted } from './featureVisibility.js';
import { getStylesArray } from '../util/featureconverter/convert.js';
import { vcsLayerName } from './layerSymbols.js';
import TileProviderFeatureProvider from '../util/featureProvider/tileProviderFeatureProvider.js';
import tileProviderFactory from './tileProvider/tileProviderFactory.js';
import { getGenericFeatureFromClickedObject } from './vectorHelpers.js';
import { originalFeatureSymbol } from './vectorSymbols.js';

/**
 * synchronizes featureVisibility Symbols on the feature;
 * @param {vcs.vcm.layer.FeatureVisibility} featureVisibility
 * @param {vcs.vcm.layer.GlobalHider} globalHider
 * @param {ol/Feature} feature
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
 * @typedef {vcs.vcm.layer.FeatureLayer.Options} vcs.vcm.layer.VectorTile.Options
 * @property {vcs.vcm.layer.tileProvider.TileProvider.Options} tileProvider
 * @property {vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.VectorStyleItem|undefined} highlightStyle
 * @property {vcs.vcm.layer.VectorProperties.Options|undefined} vectorProperties
 * @property {number|undefined} minLevel used to restrict the zoom level visibility (minlevel does not allow rendering above tileProvider baseLevel)
 * @property {number|undefined} maxLevel used to restrict the zoom level visibility
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.FeatureLayer.ImplementationOptions} vcs.vcm.layer.VectorTile.ImplementationOptions
 * @property {vcs.vcm.layer.tileProvider.TileProvider} tileProvider
 * @property {ol/Size} tileSize
 * @property {number} minLevel
 * @property {number} maxLevel
 * @property {vcs.vcm.util.Extent|undefined} extent
 */

/**
 * @typedef {vcs.vcm.layer.FeatureLayerImplementation} vcs.vcm.layer.VectorTileImplementation
 * @property {function(Array<string>):void} updateTiles
 */

/**
 * VectorTile Layer for tiled vector Data. Can be connected to data with a TileProvider
 * @class
 * @export
 * @extends {vcs.vcm.layer.FeatureLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class VectorTile extends FeatureLayer {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.VectorTile'; }

  /**
   * @returns {vcs.vcm.layer.VectorTile.Options}
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
   * @param {vcs.vcm.layer.VectorTile.Options} options
   */
  constructor(options) {
    super(options);

    this._supportedMaps = [
      CesiumMap.className,
      Openlayers.className,
    ];

    const defaultOptions = VectorTile.getDefaultOptions();

    /** @type {vcs.vcm.util.style.VectorStyleItem} */
    this.highlightStyle = /** @type {undefined} */ (defaultOptions.highlightStyle);
    if (options.highlightStyle) {
      this.highlightStyle = options.highlightStyle instanceof VectorStyleItem ?
        options.highlightStyle :
        new VectorStyleItem(options.highlightStyle);
    }

    /**
     * @type {ol/Size}
     * @private
     */
    this._tileSize = [256, 256];

    /**
     * at the moment only used for allowPicking, triggers a reload on change
     * @type {vcs.vcm.layer.VectorProperties}
     * @api
     */
    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    /**
     * @type {vcs.vcm.layer.tileProvider.TileProvider.Options}
     * @private
     */
    this._tileProviderOptions = options.tileProvider;

    /**
     * @type {vcs.vcm.layer.tileProvider.TileProvider}
     * @api
     */
    this.tileProvider = undefined;

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
    await super.initialize();
    if (!this.tileProvider) {
      this.tileProvider = await tileProviderFactory(this._tileProviderOptions);
      // this.tileProvider = await tileProviderFactory(this._tileProviderOptions);
      this._tileLoadEventListener =
        this.tileProvider.tileLoadedEvent.addEventListener(event => this._handleTileLoaded(event));
      this._vectorPropertiesChangedListener =
        this.vectorProperties.propertyChanged.addEventListener(() => {
          this.reload();
        });
      this.featureProvider = new TileProviderFeatureProvider(this.name, {
        tileProvider: this.tileProvider,
        vectorProperties: this.vectorProperties,
      });
    }
  }


  /**
   * @param {ol/Feature} olFeature
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
   * @param {vcs.vcm.layer.Vector.ClickedObject} object
   * @returns {?vcs.vcm.layer.GenericFeature}
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
   * @param {vcs.vcm.layer.tileProvider.TileProvider.tileLoadedEvent} event
   * @private
   */
  _handleTileLoaded({ source }) {
    source.forEachFeature((feature) => {
      const featureStyle = /** @type {ol/style/Style} */ (feature.getStyle());
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
              const source = this.tileProvider.sourceCache.get(tileId);
              const feature = source.getFeatureById(id);
              if (feature) {
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
              const source = this.tileProvider.sourceCache.get(tileId);
              const feature = source.getFeatureById(id);
              if (feature) {
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
        /** @type {vcs.vcm.layer.VectorTileImplementation} */ (impl).updateTiles(tileIds);
      });
  }

  /**
   * calculates the style the feature has to be rendered
   * @param {ol/Feature} feature
   * @param {number} resolution
   * @returns {Array<ol/style/Style>}
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
   * @returns {vcs.vcm.layer.VectorTile.ImplementationOptions}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.cesium.VectorRasterTileCesium|vcs.vcm.layer.openlayers.VectorTileOpenlayers>}
   */
  createImplementationsForMap(map) {
    if (map instanceof CesiumMap) {
      return [new VectorRasterTileCesium(map, this.getImplementationOptions())];
    }

    if (map instanceof Openlayers) {
      return [
        new VectorTileOpenlayers(map, this.getImplementationOptions()),
      ];
    }

    return [];
  }

  /**
   * @param {(vcs.vcm.util.style.Reference|vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options|vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.StyleItem|string)=} styleOptions
   * @param {vcs.vcm.util.style.VectorStyleItem=} defaultStyle
   * @returns {vcs.vcm.util.style.StyleItem}
   */
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return super.getStyleOrDefaultStyle(styleOptions, defaultStyle || defaultVectorStyle.clone());
  }

  /**
   * @inheritDoc
   * @returns {Promise}
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
   * @returns {vcs.vcm.layer.VectorTile.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.VectorTile.Options} */ (super.getConfigObject());
    const defaultOptions = VectorTile.getDefaultOptions();

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
      const tileProviderConfig = this.tileProvider.getConfigObject();
      config.tileProvider = tileProviderConfig;
    } else if (this._tileProviderOptions) {
      config.tileProvider = this._tileProviderOptions;
    }

    return config;
  }
}

export default VectorTile;