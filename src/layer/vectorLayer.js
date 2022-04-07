import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Feature from 'ol/Feature.js';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import Projection, { getDefaultProjection, mercatorProjection } from '../util/projection.js';
import Layer, { vcsMetaVersion } from './layer.js';
import VectorStyleItem, { defaultVectorStyle, vectorStyleSymbol } from '../style/vectorStyleItem.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import writeStyle from '../style/writeStyle.js';
import {
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from './vectorSymbols.js';
import Extent from '../util/extent.js';
import VectorProperties from './vectorProperties.js';
import FeatureLayer from './featureLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import VectorOpenlayersImpl from './openlayers/vectorOpenlayersImpl.js';
import VectorCesiumImpl from './cesium/vectorCesiumImpl.js';
import VectorObliqueImpl from './oblique/vectorObliqueImpl.js';
import ObliqueMap from '../map/obliqueMap.js';
import CesiumMap from '../map/cesiumMap.js';
import { originalStyle, updateOriginalStyle } from './featureVisibility.js';
import StyleItem from '../style/styleItem.js';
import { getGenericFeatureFromClickedObject } from './vectorHelpers.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {FeatureLayerOptions} VectorOptions
 * @property {ProjectionOptions|undefined} projection - if not specified, the framework projection is taken
 * @property {number|undefined} maxResolution
 * @property {number|undefined} minResolution
 * @property {boolean} [dontUseTerrainForOblique=false]
 * @property {number} [zIndex=10]
 * @property {VectorStyleItemOptions|import("@vcmap/core").VectorStyleItem|undefined} highlightStyle
 * @property {boolean} [isDynamic=false] - if true, the cesium synchronizers are destroyed on map change
 * @property {VectorPropertiesOptions|undefined} vectorProperties
 * @api
 */

/**
 * @typedef {Object} VectorGeometryFactoryType
 * @property {function(Array<import("ol/geom/SimpleGeometry").default>):Array<import("ol/coordinate").Coordinate>} getCoordinates
 * @property {function(import("ol/geom/SimpleGeometry").default, number):Object} getGeometryOptions
 * @property {function(Object, number, boolean, number=):Array<import("@vcmap/cesium").PolygonGeometry|import("@vcmap/cesium").CircleGeometry|import("@vcmap/cesium").WallGeometry>} createSolidGeometries
 * @property {function(Object, number, boolean, number=):Array<import("@vcmap/cesium").CircleOutlineGeometry|import("@vcmap/cesium").WallOutlineGeometry|import("@vcmap/cesium").PolygonOutlineGeometry>} createOutlineGeometries
 * @property {function(Object, number, boolean):Array<import("@vcmap/cesium").CircleGeometry|import("@vcmap/cesium").PolygonGeometry>} createFillGeometries
 * @property {function(Object, import("ol/style/Style").default):Array<import("@vcmap/cesium").GroundPolylineGeometry>} createGroundLineGeometries
 * @property {function(Object, import("ol/style/Style").default):Array<import("@vcmap/cesium").PolylineGeometry>} createLineGeometries
 * @api
 */

/**
 * @typedef {Object} VectorHeightInfo
 * @property {boolean} extruded - if the object is extruded
 * @property {Array<number>} storeyHeightsAboveGround - storey heights above ground, list has the same length as storeysAboveGround
 * @property {Array<number>} storeyHeightsBelowGround - storey heights below ground, list has the same length as storeysBelowGround
 * @property {number} groundLevel - the level above or below mean sea level (minZ value or ground_level or 0)
 * @property {number} skirt - a negative height to <i>push</i> the geometry visually into the ground
 * @property {boolean} perPositionHeight
 * @property {import("@vcmap/cesium").HeightReference} heightReference heightReference of the feature.
 * @property {number} heightAboveGroundAdjustment
 * @api
 */

/**
 * @typedef {FeatureLayerImplementationOptions} VectorImplementationOptions
 * @property {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 * @property {number} maxResolution
 * @property {number} minResolution
 * @property {VectorProperties} vectorProperties
 */

/**
 * @typedef {import("ol").Feature<import("ol/geom/Geometry").default>} VectorClickedObject
 * @property {ClickPosition} clickedPosition
 */

/**
 * VectorLayer Layer for OpenlayersMap, Cesium and ObliqueMap
 * @class
 * @export
 * @extends {FeatureLayer}
 * @api stable
 */
class VectorLayer extends FeatureLayer {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'VectorLayer'; }

  /**
   * @returns {symbol}
   * @readonly
   */
  static get alreadyTransformedToMercator() { return alreadyTransformedToMercator; }

  /**
   * @returns {symbol}
   * @readonly
   */
  static get alreadyTransformedToImage() { return alreadyTransformedToImage; }

  /**
   * @returns {symbol}
   * @readonly
   */
  static get obliqueGeometry() { return obliqueGeometry; }

  /**
   * @returns {symbol}
   * @readonly
   */
  static get doNotTransform() { return doNotTransform; }

  /**
   * @returns {symbol}
   * @readonly
   */
  static get originalFeatureSymbol() { return originalFeatureSymbol; }

  /**
   * @returns {VectorOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions(),
      projection: undefined,
      maxResolution: undefined,
      minResolution: undefined,
      dontUseTerrainForOblique: false,
      zIndex: 50,
      highlightStyle: undefined,
      isDynamic: false,
      vectorProperties: {}, // XXX or should we return VectorProperties default options?
    };
  }

  /**
   * @param {VectorOptions} options
   */
  constructor(options) {
    super(options);

    this._supportedMaps = [
      CesiumMap.className,
      ObliqueMap.className,
      OpenlayersMap.className,
    ];

    const defaultOptions = VectorLayer.getDefaultOptions();
    /** @type {import("ol/source").Vector<import("ol/geom/Geometry").default>} */
    this.source = new VectorSource({});

    /** @type {Projection} */
    this.projection = new Projection(options.projection);

    /** @type {?number} */
    this.maxResolution = options.maxResolution != null ? options.maxResolution : defaultOptions.maxResolution;

    /** @type {?number} */
    this.minResolution = options.minResolution != null ? options.minResolution : defaultOptions.minResolution;

    /** @type {boolean} */
    this.dontUseTerrainForOblique =
      parseBoolean(options.dontUseTerrainForOblique, defaultOptions.dontUseTerrainForOblique);

    /** @type {import("@vcmap/core").VectorStyleItem} */
    this.highlightStyle = /** @type {undefined} */ (defaultOptions.highlightStyle);
    if (options.highlightStyle) {
      this.highlightStyle = options.highlightStyle instanceof VectorStyleItem ?
        options.highlightStyle :
        new VectorStyleItem(options.highlightStyle);
    }

    /**
     * A flag to indicate, whether the features in the layer have a UUID, allowing certain interactions,
     * e.g. hidding its features in plannings
     * @type {boolean}
     * @api
     */
    this.hasFeatureUUID = false;
    /**
     * @type {boolean}
     * @private
     */
    this._visibility = true;
    /**
     * If true, the cesium synchronizers are destroyed on map change
     * @type {boolean}
     */
    this.isDynamic = parseBoolean(options.isDynamic, defaultOptions.isDynamic);

    /**
     * @type {Function}
     * @private
     */
    this._onStyleChangeRemover = null;

    /**
     * @type {VectorProperties}
     * @api
     */
    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    let initialStyle = options.style;
    if (options.style instanceof StyleItem) {
      initialStyle = options.style.toJSON();
    }

    /**
     * @type {StyleItemOptions}
     * @private
     */
    this._initialStyle = initialStyle;
  }

  /**
   * @api
   * @type {boolean}
   */
  get allowPicking() {
    return super.allowPicking;
  }

  /**
   * @param {boolean} allowPicking
   */
  set allowPicking(allowPicking) {
    super.allowPicking = allowPicking;
    this.vectorProperties.allowPicking = allowPicking;
  }

  /**
   * @type {boolean}
   * @api
   */
  get visibility() { return this._visibility; }

  /**
   * @param {boolean} visible
   */
  set visibility(visible) {
    if (this._visibility !== visible) {
      this._visibility = visible;
      this.forceRedraw();
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    return super.initialize()
      .then(() => {
        this._trackStyleChanges();
      });
  }

  /**
   * Returns the layers vcsMeta object
   * @param {GeoJSONwriteOptions=} options
   * @returns {VcsMeta}
   * @api
   */
  getVcsMeta(options = {}) {
    const vcsMeta = this.vectorProperties.getVcsMeta();
    vcsMeta.version = vcsMetaVersion;

    if (options.embedIcons) {
      vcsMeta.embeddedIcons = [];
    }

    if (options.writeStyle) {
      const defaultStyle = this.getStyleOrDefaultStyle(this._initialStyle);
      if (options.writeDefaultStyle || !defaultStyle.equals(this.style)) {
        writeStyle(this.style, vcsMeta);
      }
      // TODO embed icons here by running over all features? this is never used anywhere
    }

    return vcsMeta;
  }

  /**
   * Sets the meta values based on a {@link VcsMeta} Object. Does not carry over the style
   * @param {VcsMeta} vcsMeta
   */
  setVcsMeta(vcsMeta) { // XXX what about the style?
    this.vectorProperties.setVcsMeta(vcsMeta);
  }

  /**
   * @returns {VectorImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      source: this.source,
      maxResolution: this.maxResolution,
      minResolution: this.minResolution,
      vectorProperties: this.vectorProperties,
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<VectorObliqueImpl|VectorCesiumImpl|VectorOpenlayersImpl>}
   */
  createImplementationsForMap(map) {
    if (!this.visibility) {
      return [];
    }

    if (map instanceof OpenlayersMap) {
      return [new VectorOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new VectorCesiumImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof ObliqueMap) {
      return [new VectorObliqueImpl(map, this.getImplementationOptions())];
    }

    return [];
  }

  /**
   * @param {(DeclarativeStyleItemOptions|VectorStyleItemOptions|import("@vcmap/core").StyleItem)=} styleOptions
   * @param {import("@vcmap/core").VectorStyleItem=} defaultStyle
   * @returns {import("@vcmap/core").StyleItem}
   */
  getStyleOrDefaultStyle(styleOptions, defaultStyle) {
    return super.getStyleOrDefaultStyle(styleOptions, defaultStyle || defaultVectorStyle.clone());
  }

  /**
   * sets the style of this layer
   * @param {import("ol/style/Style").default|import("ol/style/Style").StyleFunction|import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   */
  setStyle(style, silent) {
    super.setStyle(style, silent);
    this._trackStyleChanges();

    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this.getFeatures().forEach((f) => {
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
  }

  /**
   * Changes features which use the layers style or if the layers style is a declarative style so they are re-rendered
   * @protected
   */
  _trackStyleChanges() {
    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
      this._onStyleChangeRemover = null;
    }

    const isDeclarative = this.style instanceof DeclarativeStyleItem;
    this._onStyleChangeRemover = this.style.styleChanged.addEventListener(() => {
      this.getFeatures().forEach((f) => {
        if (isDeclarative || !f[vectorStyleSymbol]) {
          f.changed();
        }
      });
    });
  }

  /**
   * sets the highlightstyle of this layer
   * @param {import("ol/style/Style").default|import("ol/style/Style").StyleFunction|import("@vcmap/core").VectorStyleItem} style
   * @api experimental
   */
  setHighlightStyle(style) {
    check(style, [Style, VectorStyleItem, Function]);
    if (style instanceof VectorStyleItem) {
      this.highlightStyle = style;
    } else {
      if (!this.highlightStyle) {
        this.highlightStyle = new VectorStyleItem({});
      }
      this.highlightStyle.style = style;
    }
  }

  /**
   * returns the openlayers vector source
   * @returns {import("ol/source").Vector<import("ol/geom/Geometry").default>}
   * @api
   */
  getSource() {
    return this.source;
  }

  /**
   * add features to the vector layer and return an array with their ids.
   * The geometry will be mutated and transformed to EPSG 3857 mercator coordinate system
   *
   * @param {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} features
   * @returns {Array<string|number>}
   * @api stable
   * @todo mechanism to enforce XYZ coordinate layout for internal usage
   */
  addFeatures(features) {
    check(features, [Feature]);
    const isDeclarative = this.style instanceof DeclarativeStyleItem;

    const toAdd = features
      .map((feature) => {
        const featureId = feature.getId();
        if (featureId == null) {
          feature.setId(uuidv4());
        } else {
          this.hasFeatureUUID = true;
          if (featureId && this.getFeatureById(featureId)) {
            return false;
          }
        }

        if (this.projection.epsg !== mercatorProjection.epsg) {
          const geometry = feature.getGeometry();
          if (geometry) {
            if (!geometry[VectorLayer.alreadyTransformedToMercator]) {
              geometry.transform(this.projection.proj, mercatorProjection.proj);
              geometry[VectorLayer.alreadyTransformedToMercator] = true;
            }
          }
        }

        feature[Layer.vcsLayerNameSymbol] = this.name;
        if (isDeclarative && feature[vectorStyleSymbol]) {
          feature.setStyle();
        }

        return feature;
      })
      .filter(f => f);
    this.source.addFeatures(/** @type {Array<import("ol").Feature<import("ol/geom/Geometry").default>>} */ (toAdd));
    return features.map(f => f.getId());
  }

  /**
   * removes features from the vector layer
   * @param {Array<string|number>} ids
   * @api stable
   */
  removeFeaturesById(ids) {
    const features = this.getFeaturesById(ids);
    for (let i = 0; i < features.length; i++) {
      this.source.removeFeature(features[i]);
    }
  }

  /**
   * removes all features from the vector layer
   * @api stable
   */
  removeAllFeatures() {
    this.source.clear();
  }

  /**
   * returns an array with features
   * feature geometries are always in EPSG 3857 mercator coordinate system
   * @param {Array<string|number>} ids
   * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
   * @api stable
   */
  getFeaturesById(ids) {
    check(ids, [[String, Number]]);
    return ids.map(id => this.getFeatureById(id))
      .filter(f => f != null);
  }

  /**
   * returns an feature if found, otherwise null
   * feature geometries are always in EPSG 3857 mercator coordinate system
   * @param {string|number} id
   * @returns {import("ol").Feature<import("ol/geom/Geometry").default>}
   * @api stable
   */
  getFeatureById(id) {
    return this.source.getFeatureById(id);
  }

  /**
   * returns an array with features
   * Feature geometries are always in EPSG 3857 mercator coordinate system
   * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
   * @api stable
   */
  getFeatures() {
    return this.source.getFeatures();
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on the current features.
   * Returns null of no extent was configured and the layer is void of any features with a valid geometry.
   * @returns {Extent|null}
   * @api
   */
  getZoomToExtent() {
    const metaExtent = super.getZoomToExtent(); // XXX not sure if this should be the otherway around?
    if (metaExtent) {
      return metaExtent;
    }
    const extent = new Extent({
      projection: mercatorProjection.toJSON(),
      coordinates: this.source.getExtent(),
    });
    if (extent.isValid()) {
      return extent;
    }
    return null;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} olFeature
   * @returns {?Object}
   */
  objectClickedHandler(olFeature) {
    const actualFeature = olFeature[originalFeatureSymbol] || olFeature;
    if (this.vectorProperties.getAllowPicking(actualFeature)) {
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
   * @returns {VectorOptions}
   */
  toJSON() {
    const config = /** @type {VectorOptions} */ (super.toJSON());
    const defaultOptions = VectorLayer.getDefaultOptions();

    if (this.projection.epsg !== getDefaultProjection().epsg) {
      config.projection = this.projection.toJSON();
    }

    if (this.maxResolution !== defaultOptions.maxResolution) {
      config.maxResolution = this.maxResolution;
    }

    if (this.minResolution !== defaultOptions.minResolution) {
      config.minResolution = this.minResolution;
    }

    if (this.dontUseTerrainForOblique !== defaultOptions.dontUseTerrainForOblique) {
      config.dontUseTerrainForOblique = this.dontUseTerrainForOblique;
    }

    if (this.highlightStyle) {
      config.highlightStyle = this.highlightStyle.toJSON();
    }

    if (this.isDynamic !== defaultOptions.isDynamic) {
      config.isDynamic = this.isDynamic;
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta();
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.source) {
      this.source.clear(true);
    }
    if (this._onStyleChangeRemover) {
      this._onStyleChangeRemover();
    }
    this.vectorProperties.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(VectorLayer.className, VectorLayer);
export default VectorLayer;
