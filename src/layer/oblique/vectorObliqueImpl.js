import VectorSource from 'ol/source/Vector.js';
import OLVectorLayer from 'ol/layer/Vector.js';
import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';

import { mercatorProjection } from '../../util/projection.js';
import { mercatorGeometryToImageGeometry, imageGeometryToMercatorGeometry, getPolygonizedGeometry, setNewGeometry } from './obliqueHelpers.js';
import { getGlobalHider } from '../globalHider.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../vectorSymbols.js';
import LayerObliqueImpl from './layerObliqueImpl.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';

/**
 * represents a specific vector layer for oblique.
 * @class
 * @export
 * @extends {LayerObliqueImpl}
 * @implements {FeatureLayerImplementation}
 */
class VectorObliqueImpl extends LayerObliqueImpl {
  static get className() { return 'VectorObliqueImpl'; }

  /**
   * @param {import("@vcmap/core").ObliqueMap} map
   * @param {VectorImplementationOptions} options
   */
  constructor(map, options) {
    super(map, options);

    /** @type {import("ol/source").Vector<import("ol/geom/Geometry").default>} */
    this.obliqueSource = new VectorSource({});

    /**
     * @type {Object<string, Object<string, import("ol/events").EventsKey>>}
     * @private
     */
    this._featureListeners = {};
    /**
     * @type {Array<import("ol/events").EventsKey>}
     * @private
     */
    this._sourceListener = [];
    /**
     * The extent of the current image for which features where fetched
     * @type {import("ol/extent").Extent|null}
     */
    this.currentExtent = null;
    /**
     * The image name for which the current features where fetched
     * @type {string|null}
     */
    this.fetchedFeaturesForImageName = null;

    /**
     * @type {Object<string, (number|boolean)>}
     * @private
     */
    this._updatingMercator = {};
    /**
     * @type {Object<string, (number|boolean|null)>}
     * @private
     */
    this._updatingOblique = {};
    /**
     * @type {Array<Function>}
     * @private
     */
    this._featureVisibilityListeners = [];
    /**
     * @type {import("@vcmap/core").GlobalHider}
     */
    this.globalHider = getGlobalHider();
    /**
     * @type {import("ol/source").Vector<import("ol/geom/Geometry").default>}
     */
    this.source = options.source;
    /**
     * @type {import("@vcmap/core").StyleItem}
     */
    this.style = options.style;
    /**
     * @type {import("@vcmap/core").FeatureVisibility}
     */
    this.featureVisibility = options.featureVisibility;
    /**
     * @type {import("ol/layer").Vector<import("ol/source").Vector<import("ol/geom/Geometry").default>>|null}
     */
    this.olLayer = null;
  }

  /**
   * @inheritDoc
   * @returns {import("ol/layer").Vector<import("ol/source").Vector<import("ol/geom/Geometry").default>>}
   */
  getOLLayer() {
    return new OLVectorLayer({
      visible: false,
      source: this.obliqueSource,
      style: this.style.style,
    });
  }

  /**
   * @param {import("@vcmap/core").StyleItem} style
   * @param {boolean=} silent
   */
  // eslint-disable-next-line no-unused-vars
  updateStyle(style, silent) {
    this.style = style;
    if (this.initialized) {
      this.olLayer.setStyle(this.style.style);
    }
  }

  /**
   * clears the current image and fetches features for the next
   * @private
   */
  _onObliqueImageChanged() {
    this._clearCurrentImage();
    this._fetchFeaturesInView();
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {boolean}
   * @private
   */
  _featureInExtent(feature) {
    if (this.currentExtent) {
      const geometry = feature.getGeometry();
      if (geometry) {
        return geometry[alreadyTransformedToImage] ||
          geometry.intersectsExtent(this.currentExtent);
      }
    }
    return false;
  }

  /**
   * @protected
   */
  _addSourceListeners() {
    this._sourceListener.push(/** @type {import("ol/events").EventsKey} */ (this.source.on('addfeature', /** @param {import("ol/source/Vector").VectorSourceEvent} event */ (event) => {
      const { feature } = event;
      if (this._featureInExtent(feature)) {
        this.addFeature(event.feature);
      }
    })));

    this._sourceListener.push(/** @type {import("ol/events").EventsKey} */ (this.source.on('removefeature', /** @param {import("ol/source/Vector").VectorSourceEvent} event */ (event) => {
      this.removeFeature(event.feature);
    })));

    this._sourceListener.push(/** @type {import("ol/events").EventsKey} */ (this.source.on('changefeature', /** @param {import("ol/source/Vector").VectorSourceEvent} event */ (event) => {
      const { feature } = event;
      const newFeatureId = feature.getId();
      if (!this._featureListeners[newFeatureId] && this._featureInExtent(feature)) {
        this.addFeature(feature);
      }
    })));
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this.olLayer.setVisible(true);
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(this.featureVisibility, this.source, this.globalHider);
        }
        this._addSourceListeners();
        this._imageChangedListener = this.map.imageChanged.addEventListener(this._onObliqueImageChanged.bind(this));
        await this._fetchFeaturesInView();
      }
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @returns {Promise<void>}
   * @private
   */
  addFeature(originalFeature) {
    if (!this.active) {
      this.fetchedFeaturesForImageName = null;
    }
    if (
      this.active &&
      this.currentExtent
    ) {
      const id = originalFeature.getId();
      const originalGeometry = originalFeature.getGeometry();
      if (originalFeature[doNotTransform]) {
        if (
          originalGeometry &&
          !this.obliqueSource.getFeatureById(id)
        ) {
          this.obliqueSource.addFeature(originalFeature);
        }
        return Promise.resolve();
      }

      if (this.obliqueSource.getFeatureById(id)) {
        return Promise.resolve();
      }
      const obliqueFeature = new Feature({});
      obliqueFeature.setId(id);
      obliqueFeature[originalFeatureSymbol] = originalFeature;
      setNewGeometry(originalFeature, obliqueFeature);
      obliqueFeature.setStyle(originalFeature.getStyle());

      this._setFeatureListeners(originalFeature, obliqueFeature);

      return this._convertToOblique(originalFeature, obliqueFeature)
        .then(() => {
          this.obliqueSource.addFeature(obliqueFeature);
        });
    }
    return Promise.resolve();
  }

  /**
   * @param {Object<string, import("ol/events").EventsKey>} listeners
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
   * @private
   */
  _originalGeometryChanged(listeners, originalFeature, obliqueFeature) {
    unByKey(listeners.originalGeometryChanged);
    unByKey(listeners.obliqueGeometryChanged);
    setNewGeometry(originalFeature, obliqueFeature);
    this.updateObliqueGeometry(originalFeature, obliqueFeature);
    listeners.originalGeometryChanged = /** @type {import("ol/events").EventsKey} */ (originalFeature
      .getGeometry().on('change', this.updateObliqueGeometry.bind(this, originalFeature, obliqueFeature)));
    listeners.obliqueGeometryChanged = /** @type {import("ol/events").EventsKey} */ (obliqueFeature
      .getGeometry().on('change', this.updateMercatorGeometry.bind(this, originalFeature, obliqueFeature)));
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
   * @private
   */
  _setFeatureListeners(originalFeature, obliqueFeature) {
    const featureId = obliqueFeature.getId();
    const listeners = {
      originalFeatureGeometryChanged: /** @type {import("ol/events").EventsKey} */ (originalFeature.on('change:geometry', () => {
        const originalGeometry = originalFeature.getGeometry();
        if (originalGeometry[actuallyIsCircle]) {
          unByKey(listeners.originalGeometryChanged);
          listeners.originalGeometryChanged = /** @type {import("ol/events").EventsKey} */ (originalFeature
            .getGeometry().on('change', () => {
              if (this._updatingMercator[featureId]) {
                return;
              }
              delete originalGeometry[actuallyIsCircle];
              this._originalGeometryChanged(listeners, originalFeature, obliqueFeature);
            }));
          return;
        }
        this._originalGeometryChanged(listeners, originalFeature, obliqueFeature);
      })),
      originalFeatureChanged: /** @type {import("ol/events").EventsKey} */ (originalFeature
        .on('change', () => { obliqueFeature.setStyle(originalFeature.getStyle()); })),
      originalGeometryChanged: /** @type {import("ol/events").EventsKey} */ (originalFeature
        .getGeometry().on('change', this.updateObliqueGeometry.bind(this, originalFeature, obliqueFeature))),
      obliqueGeometryChanged: /** @type {import("ol/events").EventsKey} */ (obliqueFeature
        .getGeometry().on('change', this.updateMercatorGeometry.bind(this, originalFeature, obliqueFeature))),
    };
    this._featureListeners[featureId] = listeners;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
   * @returns {Promise<void>}
   * @private
   */
  async _convertToOblique(originalFeature, obliqueFeature) {
    const id = originalFeature.getId();
    const vectorGeometry = originalFeature.getGeometry();
    const imageGeometry = obliqueFeature.getGeometry();
    this._updatingOblique[id] = true;
    if (!vectorGeometry[alreadyTransformedToImage]) {
      await mercatorGeometryToImageGeometry(vectorGeometry, imageGeometry, this.map.currentImage);
    } else {
      obliqueFeature.getGeometry().setCoordinates(vectorGeometry.getCoordinates());
    }
    this._updatingOblique[id] = null;
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
   */
  updateObliqueGeometry(originalFeature, obliqueFeature) {
    const id = originalFeature.getId();
    if (this._updatingMercator[id]) {
      return;
    }
    if (this._updatingOblique[id] != null) {
      clearTimeout(/** @type {number} */ (this._updatingOblique[id]));
    }
    this._updatingOblique[id] = setTimeout(() => {
      this._convertToOblique(originalFeature, obliqueFeature);
    }, 200);
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} originalFeature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} obliqueFeature
   */
  updateMercatorGeometry(originalFeature, obliqueFeature) {
    const id = originalFeature.getId();
    if (this._updatingOblique[id]) {
      return;
    }
    if (this._updatingMercator[id] != null) {
      clearTimeout(/** @type {number} */ (this._updatingMercator[id]));
    }
    const imageName = this.fetchedFeaturesForImageName;
    this._updatingMercator[id] = setTimeout(async () => {
      const originalGeometry = getPolygonizedGeometry(originalFeature, false);
      if (originalGeometry[actuallyIsCircle]) {
        originalFeature.setGeometry(originalGeometry);
      }
      const imageGeometry = getPolygonizedGeometry(obliqueFeature, true);
      this._updatingMercator[id] = true;
      await imageGeometryToMercatorGeometry(
        imageGeometry,
        originalGeometry,
        this.map.collection.getImageByName(imageName),
      );
      this._updatingMercator[id] = null;
    }, 200);
  }

  /**
   * Synchronizes image Features if the geometry has been changed.
   * also clears source and featureListeners
   */
  _clearCurrentImage() {
    Object.values(this._featureListeners)
      .forEach((listeners) => {
        unByKey(Object.values(listeners));
      });
    this._featureListeners = {};
    this._updatingOblique = {};
    this._updatingMercator = {};
    this.obliqueSource.getFeatures().forEach((f) => {
      const original = f[originalFeatureSymbol];
      if (original) {
        delete original[obliqueGeometry];
        delete original.getGeometry()[alreadyTransformedToImage];
      }
    });
    this.obliqueSource.clear(true);
    this.fetchedFeaturesForImageName = null;
  }

  /**
   * Fetches the features within the extent of the current image
   * @private
   */
  _fetchFeaturesInView() {
    if (
      this.active &&
      this.map.currentImage &&
      this.fetchedFeaturesForImageName !== this.map.currentImage.name
    ) {
      this.currentExtent = this.map.getExtentOfCurrentImage()
        .getCoordinatesInProjection(mercatorProjection);
      this.source.forEachFeatureInExtent(this.currentExtent, (feature) => {
        this.addFeature(feature);
      });
      this.source.forEachFeature((feature) => {
        if (feature.getGeometry()[alreadyTransformedToImage]) {
          this.addFeature(feature);
        }
      });
      this.fetchedFeaturesForImageName = this.map.currentImage.name;
    }
  }

  /**
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @private
   */
  removeFeature(feature) {
    const feat = this.obliqueSource.getFeatureById(feature.getId());
    if (feat) {
      const id = /** @type {string} */ (feat.getId());
      const listeners = this._featureListeners[id];
      if (listeners) {
        unByKey(Object.values(listeners));
        delete this._featureListeners[id];
      }
      this.obliqueSource.removeFeature(feat);
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }

    this._featureVisibilityListeners.forEach((cb) => { cb(); });
    this._featureVisibilityListeners = [];

    unByKey(this._sourceListener);
    this._sourceListener = [];

    if (this._imageChangedListener) {
      this._imageChangedListener();
      this._imageChangedListener = null;
    }

    this._clearCurrentImage();
  }

  /**
   * @inheritDoc
   */
  destroy() {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;

    unByKey(this._sourceListener);
    this._sourceListener = [];

    if (this._imageChangedListener) {
      this._imageChangedListener();
      this._imageChangedListener = null;
    }
    this.obliqueSource.clear(true);
    Object.values(this._updatingOblique).forEach((timer) => {
      if (timer != null) {
        clearTimeout(/** @type {number} */ (timer));
      }
    });
    Object.values(this._updatingMercator).forEach((timer) => {
      if (timer != null) {
        clearTimeout(/** @type {number} */ (timer));
      }
    });
    this._clearCurrentImage();
    super.destroy();
  }
}

export default VectorObliqueImpl;
