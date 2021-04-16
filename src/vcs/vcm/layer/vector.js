import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Feature from 'ol/Feature.js';
import { v4 as uuidv4 } from 'uuid';
import { check } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import Projection, { getDefaultProjection, mercatorProjection } from '../util/projection.js';
import Layer, { vcsMetaVersion } from './layer.js';
import VectorStyleItem, { defaultVectorStyle, vectorStyleSymbol } from '../util/style/vectorStyleItem.js';
import DeclarativeStyleItem from '../util/style/declarativeStyleItem.js';
import writeStyle from '../util/style/writeStyle.js';
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
import Openlayers from '../maps/openlayers.js';
import VectorOpenlayers from './openlayers/vectorOpenlayers.js';
import VectorCesium from './cesium/vectorCesium.js';
import VectorOblique from './oblique/vectorOblique.js';
import Oblique from '../maps/oblique.js';
import CesiumMap from '../maps/cesium.js';
import { originalStyle, updateOriginalStyle } from './featureVisibility.js';
import StyleItem, { referenceableStyleSymbol, StyleType } from '../util/style/styleItem.js';
import { getGenericFeatureFromClickedObject } from './vectorHelpers.js';

/**
 * @typedef {vcs.vcm.layer.FeatureLayer.Options} vcs.vcm.layer.Vector.Options
 * @property {vcs.vcm.util.Projection.Options|undefined} projection - if not specified, the framework projection is taken
 * @property {number|undefined} maxResolution
 * @property {number|undefined} minResolution
 * @property {boolean} [dontUseTerrainForOblique=false]
 * @property {number} [zIndex=10]
 * @property {vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.VectorStyleItem|undefined} highlightStyle
 * @property {boolean} [isDynamic=false] - if true, the cesium synchronizers are destroyed on map change
 * @property {vcs.vcm.layer.VectorProperties.Options|undefined} vectorProperties
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.Vector.GeometryFactoryType
 * @property {function(Array<ol/geom/SimpleGeometry>):Array<ol/Coordinate>} getCoordinates
 * @property {function(ol/geom/SimpleGeometry, number):Object} getGeometryOptions
 * @property {function(Object, number, boolean, number=):Array<Cesium/PolygonGeometry|Cesium/CircleGeometry|Cesium/WallGeometry>} createSolidGeometries
 * @property {function(Object, number, boolean, number=):Array<Cesium/CircleOutlineGeometry|Cesium/WallOutlineGeometry|Cesium/PolygonOutlineGeometry>} createOutlineGeometries
 * @property {function(Object, number, boolean):Array<Cesium/CircleGeometry|Cesium/PolygonGeometry>} createFillGeometries
 * @property {function(Object, ol/style/Style):Array<Cesium/GroundPolylineGeometry>} createGroundLineGeometries
 * @property {function(Object, ol/style/Style):Array<Cesium/PolylineGeometry>} createLineGeometries
 * @api
 */

/**
 * @typedef {Object} vcs.vcm.layer.Vector.HeightInfo
 * @property {boolean} extruded - if the object is extruded
 * @property {Array<number>} storeyHeightsAboveGround - storey heights above ground, list has the same length as storeysAboveGround
 * @property {Array<number>} storeyHeightsBelowGround - storey heights below ground, list has the same length as storeysBelowGround
 * @property {number} groundLevel - the level above or below mean sea level (minZ value or ground_level or 0)
 * @property {number} skirt - a negative height to <i>push</i> the geometry visually into the ground
 * @property {boolean} perPositionHeight
 * @property {Cesium/HeightReference} heightReference heightReference of the feature.
 * @property {number} heightAboveGroundAdjustment
 * @api
 */

/**
 * @typedef {vcs.vcm.layer.FeatureLayer.ImplementationOptions} vcs.vcm.layer.Vector.ImplementationOptions
 * @property {ol/source/Vector} source
 * @property {number} maxResolution
 * @property {number} minResolution
 * @property {vcs.vcm.layer.VectorProperties} vectorProperties
 */

/**
 * @typedef {ol/Feature} vcs.vcm.layer.Vector.ClickedObject
 * @property {vcs.vcm.maps.ClickPosition} clickedPosition
 */

/**
 * Vector Layer for Openlayers, Cesium and Oblique
 * @class
 * @export
 * @extends {vcs.vcm.layer.FeatureLayer}
 * @api stable
 * @memberOf vcs.vcm.layer
 */
class Vector extends FeatureLayer {
  /**
   * @readonly
   * @returns {string}
   */
  static get className() { return 'vcs.vcm.layer.Vector'; }

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
   * @returns {vcs.vcm.layer.Vector.Options}
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
   * @param {vcs.vcm.layer.Vector.Options} options
   */
  constructor(options) {
    super(options);

    this._supportedMaps = [
      CesiumMap.className,
      Oblique.className,
      Openlayers.className,
    ];

    const defaultOptions = Vector.getDefaultOptions();
    /** @type {ol/source/Vector} */
    this.source = new VectorSource({});

    /** @type {vcs.vcm.util.Projection} */
    this.projection = new Projection(options.projection);

    /** @type {?number} */
    this.maxResolution = options.maxResolution != null ? options.maxResolution : defaultOptions.maxResolution;

    /** @type {?number} */
    this.minResolution = options.minResolution != null ? options.minResolution : defaultOptions.minResolution;

    /** @type {boolean} */
    this.dontUseTerrainForOblique =
      parseBoolean(options.dontUseTerrainForOblique, defaultOptions.dontUseTerrainForOblique);

    /** @type {vcs.vcm.util.style.VectorStyleItem} */
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
     * @type {vcs.vcm.layer.VectorProperties}
     * @api
     */
    this.vectorProperties = new VectorProperties({
      allowPicking: this.allowPicking,
      ...options.vectorProperties,
    });

    let initialStyle = options.style;
    if (options.activeStyleName) {
      initialStyle = {
        type: StyleType.REFERENCE,
        name: options.activeStyleName,
      };
    } else if (options.style instanceof StyleItem) {
      initialStyle = options.style.getOptions();
    }

    /**
     * @type {vcs.vcm.util.style.Reference|vcs.vcm.util.style.StyleItem.Options|string}
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
   * @param {vcs.vcm.layer.GeoJSON.writeOptions=} options
   * @returns {vcs.vcm.layer.VcsMeta}
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
   * Sets the meta values based on a {@link vcs.vcm.layer.VcsMeta} Object. Does not carry over the style
   * @param {vcs.vcm.layer.VcsMeta} vcsMeta
   */
  setVcsMeta(vcsMeta) { // XXX what about the style?
    this.vectorProperties.setVcsMeta(vcsMeta);
  }

  /**
   * @returns {vcs.vcm.layer.Vector.ImplementationOptions}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.oblique.VectorOblique|vcs.vcm.layer.cesium.VectorCesium|vcs.vcm.layer.openlayers.VectorOpenlayers>}
   */
  createImplementationsForMap(map) {
    if (!this.visibility) {
      return [];
    }

    if (map instanceof Openlayers) {
      return [new VectorOpenlayers(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new VectorCesium(map, this.getImplementationOptions())];
    }

    if (map instanceof Oblique) {
      return [new VectorOblique(map, this.getImplementationOptions())];
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
   * sets the style of this layer
   * @param {ol/style/Style|ol/style/StyleFunction|vcs.vcm.util.style.StyleItem|string} style
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
   * @param {ol/style/Style|ol/style/StyleFunction|vcs.vcm.util.style.VectorStyleItem} style
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
   * @returns {ol/source/Vector}
   * @api
   */
  getSource() {
    return this.source;
  }

  /**
   * add features to the vector layer and return an array with their ids.
   * The geometry will be mutated and transformed to EPSG 3857 mercator coordinate system
   *
   * @param {Array<ol/Feature>} features
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
            if (!geometry[Vector.alreadyTransformedToMercator]) {
              geometry.transform(this.projection.proj, mercatorProjection.proj);
              geometry[Vector.alreadyTransformedToMercator] = true;
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
    this.source.addFeatures(/** @type {Array<ol/Feature>} */ (toAdd));
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
   * @returns {Array<ol/Feature>}
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
   * @returns {ol/Feature}
   * @api stable
   */
  getFeatureById(id) {
    return this.source.getFeatureById(id);
  }

  /**
   * returns an array with features
   * Feature geometries are always in EPSG 3857 mercator coordinate system
   * @returns {Array.<ol/Feature>}
   * @api stable
   */
  getFeatures() {
    return this.source.getFeatures();
  }

  /**
   * Returns the configured Extent of this layer or tries to calculate the extent based on the current features.
   * Returns null of no extent was configured and the layer is void of any features with a valid geometry.
   * @returns {vcs.vcm.util.Extent|null}
   * @api
   */
  getZoomToExtent() {
    const metaExtent = super.getZoomToExtent(); // XXX not sure if this should be the otherway around?
    if (metaExtent) {
      return metaExtent;
    }
    const extent = new Extent({
      ...mercatorProjection.getConfigObject(),
      coordinates: this.source.getExtent(),
    });
    if (extent.isValid()) {
      return extent;
    }
    return null;
  }

  /**
   * @param {ol/Feature} olFeature
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
   * @param {vcs.vcm.layer.Vector.ClickedObject} object
   * @returns {?vcs.vcm.layer.GenericFeature}
   */
  getGenericFeatureFromClickedObject(object) {
    return getGenericFeatureFromClickedObject(object, this);
  }

  /**
   * @returns {vcs.vcm.layer.Vector.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.Vector.Options} */ (super.getConfigObject());
    const defaultOptions = Vector.getDefaultOptions();

    if (this.projection.epsg !== getDefaultProjection().epsg) {
      config.projection = this.projection.getConfigObject();
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
      config.highlightStyle = this.highlightStyle[referenceableStyleSymbol] ?
        this.highlightStyle.getReference() :
        this.highlightStyle.getOptions();
    }

    if (this.isDynamic !== defaultOptions.isDynamic) {
      config.isDynamic = this.isDynamic;
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta();
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    // XXX missing style

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

export default Vector;
