import { v4 as uuidv4 } from 'uuid';
import { parseBoolean } from '@vcsuite/parsers';
import { vcsLayerName } from '../layer/layerSymbols.js';
import VcsObject from '../vcsObject.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import { defaultVectorStyle } from '../style/vectorStyleItem.js';
import VectorProperties from '../layer/vectorProperties.js';
import { isProvidedFeature, showProvidedFeature } from './featureProviderSymbols.js';

/**
 * @namespace featureProvider
 */

/**
 * @typedef {VcsObjectOptions} AbstractFeatureProviderOptions
 * @property {import("@vcmap/core").StyleItemOptions|import("@vcmap/core").StyleItem|undefined} style - the style to apply to features created by this feature provider
 * @property {Object|undefined} genericFeatureProperties - generic properties to add to features created by this feature provider
 * @property {import("@vcmap/core").VectorProperties|import("@vcmap/core").VectorPropertiesOptions|undefined} vectorProperties - the vector properties of the features. Allow picking is false by default.
 * @property {boolean} [showGeometry=false] - show the resulting geometry in the map
 * @property {Array<string>} [mapTypes=[]] - can be used to constrict the featureProvider to specific mapTypes empty array means no restriction
 */

/**
 * An abstract class providing features for {@link Layer}s which cannot provide features directly, but can provide features for
 * a given location, e.g. WmsLayer with a getFeatureInfo configuration. In this case, a feature provider can be created for this layer.
 * @class
 * @export
 * @abstract
 * @api
 */
class AbstractFeatureProvider extends VcsObject {
  static get className() { return 'AbstractFeatureProvider'; }

  /**
   * @returns {AbstractFeatureProviderOptions}
   */
  static getDefaultOptions() {
    return {
      vectorProperties: {
        allowPicking: false,
      },
      genericFeatureProperties: undefined,
      showGeometry: false,
      mapTypes: [],
    };
  }

  /**
   * @param {string} layerName
   * @param {AbstractFeatureProviderOptions} options
   */
  constructor(layerName, options) {
    super(options);
    const defaultOptions = AbstractFeatureProvider.getDefaultOptions();
    /**
     * The layer name of the associated layer
     * @api
     * @type {string}
     */
    this.layerName = layerName;
    /**
     * The style set on features created by this provider
     * @type {import("@vcmap/core").StyleItem|undefined}
     * @api
     */
    this.style = options.style ?
      getStyleOrDefaultStyle(options.style, defaultVectorStyle.clone()) :
      undefined;
    /**
     * Whether to show the geometry on selection.
     * @type {boolean}
     * @api
     */
    this.showGeometry = parseBoolean(options.showGeometry, defaultOptions.showGeometry);
    /**
     * The vector properties assigned to features created by this provider
     * @type {import("@vcmap/core").VectorProperties}
     * @api
     */
    this.vectorProperties = options.vectorProperties instanceof VectorProperties ?
      options.vectorProperties :
      new VectorProperties({ ...defaultOptions.vectorProperties, ...options.vectorProperties });
    /**
     * An object of potential generic feature properties to add to all feature created by this provider
     * @type {Object<string, *>|undefined}
     * @api
     */
    this.genericFeatureProperties = options.genericFeatureProperties || defaultOptions.genericFeatureProperties;

    /**
     * Map ClassNames Can be used to only apply this featureProvider to the specified maps
     * @type {Array<string>}
     * @api
     */
    this.mapTypes = Array.isArray(options.mapTypes) ? options.mapTypes : defaultOptions.mapTypes;
  }

  /**
   * checks if the featureProvider is supported for provided Map
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {boolean}
   * @api stable
   */
  isSupported(map) {
    return map &&
      (this.mapTypes.length === 0 || this.mapTypes.includes(map.className));
  }

  /**
   * Ensures the feature has an ID, applies all vectorProperties and adds the generic properties, style and the vcsLayerName
   * and isProvidedFeature symbols to the feature
   * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
   * @returns {import("ol").Feature<import("ol/geom/Geometry").default>}
   * @api
   */
  getProviderFeature(feature) {
    if (!feature.getId()) {
      feature.setId(uuidv4());
    }
    if (this.style) {
      feature.setStyle(this.style.style);
    }
    if (this.genericFeatureProperties) {
      feature.setProperties(this.genericFeatureProperties);
    }
    feature[vcsLayerName] = this.layerName;
    feature[isProvidedFeature] = true;
    feature[showProvidedFeature] = this.showGeometry;
    Object.entries(this.vectorProperties.getValues()).forEach(([key, value]) => {
      const olcsKey = `olcs_${key}`;
      if (feature.get(olcsKey) === undefined && value !== undefined) {
        feature.set(olcsKey, value);
      }
    });
    return feature;
  }

  /**
   * This method must be overwritten by any implementations. Before returning the array of features, be sure to use the getProviderFeature
   * on each feature to ensure all properties and symbols required by the VCM architecture
   * to handle your feature is called: (e.g. <code>return features.map(f => this.getProviderFeature(f)</code>);
   * @param {import("ol/coordinate").Coordinate} coordinate - in mercator
   * @param {number} resolution - meters per pixel for the given location
   * @returns {Promise<Array<import("ol").Feature<import("ol/geom/Geometry").default>>>}
   * @api
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  async getFeaturesByCoordinate(coordinate, resolution) {
    return [];
  }

  /**
   * Returns the object required to configure this feature provider.
   * @returns {AbstractFeatureProviderOptions}
   * @api
   */
  toJSON() {
    const config =
      /** @type {AbstractFeatureProviderOptions} */ (super.toJSON());

    const defaultOptions = AbstractFeatureProvider.getDefaultOptions();
    delete config.name; // the name is irrelevant, since its the layers name

    if (this.showGeometry !== defaultOptions.showGeometry) {
      config.showGeometry = this.showGeometry;
    }

    if (this.genericFeatureProperties) {
      config.genericFeatureProperties = { ...this.genericFeatureProperties };
    }

    if (this.style) {
      config.style = this.style.toJSON();
    }

    const vectorPropertiesConfig = this.vectorProperties
      .getVcsMeta({ ...VectorProperties.getDefaultOptions(), ...defaultOptions.vectorProperties });
    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }
    return config;
  }

  /**
   * Destroys this feature provider and detaches its resources
   * @inheritDoc
   */
  destroy() {
    this.style = null;
    this.vectorProperties.destroy();
    this.genericFeatureProperties = undefined;
    super.destroy();
  }
}

export default AbstractFeatureProvider;
