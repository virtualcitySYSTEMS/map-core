import Feature from 'ol/Feature.js';
import type { Extent } from 'ol/extent.js';
import { v4 as uuid } from 'uuid';
import { is, oneOf } from '@vcsuite/check';
import {
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity,
} from '@vcmap-cesium/engine';
import VcsObject, { type VcsObjectOptions } from '../vcsObject.js';
import type { EventFeature } from '../interaction/abstractInteraction.js';
import { featureExists } from '../layer/featureVisibility.js';

export type AbstractAttributeProviderOptions = VcsObjectOptions & {
  keyProperty?: string;
};

export const attributeProviderName = Symbol('attributeProvider');

export interface AttributeProvider extends VcsObject {
  /**
   * Augments a feature with attributes from the provider
   * @param feature
   */
  augmentFeature(feature: EventFeature): Promise<void>;
  /**
   * Augments multiple features with attributes from the provider
   * @param features
   * @param extent - optional extent in webmercator to limit attribute lookup on certain providers.
   */
  augmentFeatures(features: EventFeature[], extent?: Extent): Promise<void>;
}

export default abstract class AbstractAttributeProvider
  extends VcsObject
  implements AttributeProvider
{
  static get className(): string {
    return 'AbstractAttributeProvider';
  }

  static getDefaultOptions(): AbstractAttributeProviderOptions {
    return {
      ...VcsObject.getDefaultOptions(),
      keyProperty: undefined,
    };
  }

  private _id = uuid();

  keyProperty?: string;

  constructor(options: AbstractAttributeProviderOptions) {
    super(options);

    this.keyProperty = options.keyProperty;
  }

  private _setAttributesOnFeature(
    feature: EventFeature,
    attributes: Record<string, unknown>,
  ): void {
    if (feature instanceof Feature) {
      feature.setProperties(attributes, true);
      feature.changed();
    } else if (
      feature instanceof Cesium3DTileFeature ||
      feature instanceof Cesium3DTilePointFeature
    ) {
      if (featureExists(feature)) {
        for (const key of Object.keys(attributes)) {
          feature.setAttribute(key, attributes[key]);
        }
      }

      feature[attributeProviderName] = this._id;
    } else if (feature instanceof Entity) {
      for (const key of Object.keys(attributes)) {
        feature.properties?.addProperty(key, attributes[key]);
      }
      feature[attributeProviderName] = this._id;
    }
  }

  private _getKeyForFeature(feature: EventFeature): string | undefined {
    let key: unknown;
    if (this.keyProperty) {
      key = feature.getProperty(this.keyProperty) as unknown;
    } else {
      key = feature.getId();
    }

    if (is(key, oneOf(String, Number))) {
      return String(key);
    }
    return undefined;
  }

  /**
   * Retrieves attributes for a given key and feature.
   * Be sure not to use the feature id for lookup, but the provided key.
   * @param key - the key to retrieve attributes for
   * @param feature - the feature requesting the attributes
   * @protected
   */
  protected abstract _getAttributes(
    key: string,
    feature: EventFeature,
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Optional bulk attribute retrieval for multiple keys.
   * Can be implemented for optimal loading of data.
   * Provides a webmercator extent to limit the lookup if needed.
   * You MUST return a same length array as keys, with undefined for missing attributes.
   * @param bulk - array of key and feature pairs to retrieve attributes for
   * @param _extent - optional extent in webmercator to limit attribute lookup on certain providers.
   * @protected
   */
  protected _getBulkAttributes(
    bulk: { key: string; feature: EventFeature }[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _extent?: Extent,
  ): Promise<(Record<string, unknown> | undefined)[]> {
    return Promise.all(
      bulk.map(({ key, feature }) => this._getAttributes(key, feature)),
    );
  }

  /**
   * Augments a feature with attributes from the provider
   * @param feature
   */
  async augmentFeature(feature: EventFeature): Promise<void> {
    if (feature[attributeProviderName] !== this._id) {
      const key = this._getKeyForFeature(feature);
      if (key) {
        const attributes = await this._getAttributes(key, feature);
        if (attributes) {
          this._setAttributesOnFeature(feature, attributes);
        }
      }
    }
    feature[attributeProviderName] = this._id;
  }

  /**
   * Augments multiple features with attributes from the provider
   * @param features
   * @param extent - optional extent in webmercator to limit attribute lookup on certain providers.
   */
  async augmentFeatures(
    features: EventFeature[],
    extent?: Extent,
  ): Promise<void> {
    const bulk = features
      .map((feature) => {
        if (feature[attributeProviderName] !== this._id) {
          const key = this._getKeyForFeature(feature);
          if (key) {
            return { key, feature };
          }
        }
        feature[attributeProviderName] = this._id;
        return undefined;
      })
      .filter((i) => !!i);

    if (bulk.length === 0) {
      return;
    }

    const attributes = await this._getBulkAttributes(bulk, extent);
    if (attributes.length !== bulk.length) {
      this.getLogger().error(
        `Bulk attribute retrieval returned ${attributes.length} results for ${bulk.length} features.`,
      );
      return;
    }

    for (let i = 0; i < bulk.length; i++) {
      const attr = attributes[i];
      if (attr) {
        this._setAttributesOnFeature(bulk[i].feature, attr);
      }
    }
  }

  toJSON(
    defaultOptions = AbstractAttributeProvider.getDefaultOptions(),
  ): AbstractAttributeProviderOptions {
    const config = super.toJSON(
      defaultOptions,
    ) as AbstractAttributeProviderOptions;

    if (this.keyProperty !== defaultOptions.keyProperty) {
      config.keyProperty = this.keyProperty;
    }
    return config;
  }
}
