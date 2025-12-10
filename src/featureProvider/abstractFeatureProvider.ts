import { v4 as uuidv4 } from 'uuid';
import type { Feature } from 'ol/index.js';
import type { Coordinate } from 'ol/coordinate.js';

import { vcsLayerName } from '../layer/layerSymbols.js';
import VcsObject, { type VcsObjectOptions } from '../vcsObject.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';
import {
  defaultVectorStyle,
  type VectorStyleItemOptions,
} from '../style/vectorStyleItem.js';
import VectorProperties, {
  type VectorPropertiesOptions,
} from '../layer/vectorProperties.js';
import { isProvidedFeature } from './featureProviderSymbols.js';
import type StyleItem from '../style/styleItem.js';
import { type StyleItemOptions } from '../style/styleItem.js';
import type VcsMap from '../map/vcsMap.js';
import type { DeclarativeStyleItemOptions } from '../style/declarativeStyleItem.js';
import type Layer from '../layer/layer.js';

export type AbstractFeatureProviderOptions = VcsObjectOptions & {
  /**
   * the style to apply to features created by this feature provider
   */
  style?:
    | StyleItemOptions
    | VectorStyleItemOptions
    | DeclarativeStyleItemOptions
    | StyleItem;
  /**
   * the vector properties of the features. Allow picking is false by default.
   */
  vectorProperties?: VectorProperties | VectorPropertiesOptions;
  /**
   * can be used to constrict the featureProvider to specific mapTypes empty array means no restriction
   */
  mapTypes?: string[];
};

/**
 * An abstract class providing features for {@link Layer}s which cannot provide features directly, but can provide features for
 * a given location, e.g. WmsLayer with a getFeatureInfo configuration. In this case, a feature provider can be created for this layer.
 */
abstract class AbstractFeatureProvider extends VcsObject {
  static get className(): string {
    return 'AbstractFeatureProvider';
  }

  static getDefaultOptions(): AbstractFeatureProviderOptions {
    return {
      vectorProperties: {
        allowPicking: false,
      },
      mapTypes: [],
    };
  }

  /**
   * The style set on features created by this provider
   */
  style: StyleItem | undefined;

  /**
   * The vector properties assigned to features created by this provider
   */
  vectorProperties: VectorProperties;

  /**
   * Map ClassNames Can be used to only apply this featureProvider to the specified maps
   */
  mapTypes: string[];

  constructor(options: AbstractFeatureProviderOptions) {
    const defaultOptions = AbstractFeatureProvider.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.style = options.style
      ? getStyleOrDefaultStyle(options.style, defaultVectorStyle.clone())
      : undefined;

    this.vectorProperties =
      options.vectorProperties instanceof VectorProperties
        ? options.vectorProperties
        : new VectorProperties({
            ...(defaultOptions.vectorProperties as VectorPropertiesOptions),
            ...options.vectorProperties,
          });

    this.mapTypes = Array.isArray(options.mapTypes)
      ? options.mapTypes
      : (defaultOptions.mapTypes as string[]);
  }

  /**
   * checks if the featureProvider is supported for provided Map
   */
  isSupported(map: VcsMap): boolean {
    return (
      map &&
      (this.mapTypes.length === 0 || this.mapTypes.includes(map.className))
    );
  }

  /**
   * Ensures the feature has an ID, applies all vectorProperties and adds style and the vcsLayerName
   * and isProvidedFeature symbols to the feature
   */
  getProviderFeature(feature: Feature, layer: Layer): Feature {
    if (!feature.getId()) {
      feature.setId(uuidv4());
    }
    if (this.style) {
      feature.setStyle(this.style.style);
    }
    feature[vcsLayerName] = layer.name;
    feature[isProvidedFeature] = true;
    Object.entries(this.vectorProperties.getValues()).forEach(
      ([key, value]) => {
        const olcsKey = `olcs_${key}`;
        if (feature.get(olcsKey) === undefined && value !== undefined) {
          feature.set(olcsKey, value);
        }
      },
    );
    return feature;
  }

  /**
   * This method must be overwritten by any implementations. Before returning the array of features, be sure to use the getProviderFeature
   * on each feature to ensure all properties and symbols required by the VCM architecture
   * to handle your feature is called: (e.g. <code>return features.map(f => this.getProviderFeature(f)</code>);
   * @param coordinate - in mercator
   * @param resolution - meters per pixel for the given location
   * @param layer - the layer to request the features for
   */
  abstract getFeaturesByCoordinate(
    coordinate: Coordinate,
    resolution: number,
    layer: Layer,
  ): Promise<Feature[]>;

  /**
   * Returns the object required to configure this feature provider.
   */
  toJSON(
    defaultOptions = AbstractFeatureProvider.getDefaultOptions(),
  ): AbstractFeatureProviderOptions {
    const config: AbstractFeatureProviderOptions = super.toJSON(defaultOptions);

    if (this.style) {
      config.style = this.style.toJSON();
    }

    const vectorPropertiesConfig = this.vectorProperties.getVcsMeta({
      ...VectorProperties.getDefaultOptions(),
      ...(defaultOptions.vectorProperties as VectorPropertiesOptions),
    });

    if (Object.keys(vectorPropertiesConfig).length > 0) {
      config.vectorProperties = vectorPropertiesConfig;
    }

    if (this.mapTypes.length > 0) {
      config.mapTypes = this.mapTypes.slice();
    }

    return config;
  }

  destroy(): void {
    this.style = undefined;
    this.vectorProperties.destroy();
    super.destroy();
  }
}

export default AbstractFeatureProvider;
