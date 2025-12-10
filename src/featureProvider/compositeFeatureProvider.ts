import type Feature from 'ol/Feature.js';
import type { Extent } from 'ol/extent.js';
import type { AbstractFeatureProviderOptions } from './abstractFeatureProvider.js';
import AbstractFeatureProvider from './abstractFeatureProvider.js';
import AbstractAttributeProvider, {
  type AbstractAttributeProviderOptions,
  type AttributeProvider,
} from './abstractAttributeProvider.js';
import type { EventFeature } from '../interaction/abstractInteraction.js';
import type Layer from '../layer/layer.js';
import { getProviderForOption } from './featureProviderFactory.js';

export type CompositeFeatureProviderOptions = AbstractFeatureProviderOptions & {
  featureProviders: (
    | AbstractFeatureProviderOptions
    | AbstractFeatureProvider
  )[];
  attributeProviders: (
    | AbstractAttributeProviderOptions
    | AbstractAttributeProvider
  )[];
};

/**
 * A feature provider that combines multiple feature providers and attribute providers.
 * Used to combine multiple feature & attribute providers for a layer.
 * The order of providers is important, as attributes are applied and
 * features are returned in the order.
 */
export default class CompositeFeatureProvider
  extends AbstractFeatureProvider
  implements AttributeProvider
{
  static get className(): string {
    return 'CompositeFeatureProvider';
  }

  private _attributeProviders: AttributeProvider[];

  private _featureProviders: AbstractFeatureProvider[];

  constructor(options: CompositeFeatureProviderOptions) {
    super(options);
    this._featureProviders = options.featureProviders
      .map(getProviderForOption)
      .filter((fp) => fp instanceof AbstractFeatureProvider);

    this._featureProviders.forEach((fp) => {
      fp.mapTypes = this.mapTypes;
    });

    this._attributeProviders = options.attributeProviders
      .map(getProviderForOption)
      .filter((ap) => ap instanceof AbstractAttributeProvider);
  }

  async augmentFeatures(
    features: EventFeature[],
    extent?: Extent,
  ): Promise<void> {
    for (const provider of this._attributeProviders) {
      // order is relevant. second provider can overwrite or use attributes of first provider.
      // eslint-disable-next-line no-await-in-loop
      await provider.augmentFeatures(features, extent);
    }
  }

  async getFeaturesByCoordinate(
    coordinate: [number, number],
    resolution: number,
    layer: Layer,
  ): Promise<Feature[]> {
    const featureArray = await Promise.all(
      this._featureProviders.map((fp) =>
        fp.getFeaturesByCoordinate(coordinate, resolution, layer),
      ),
    );

    return featureArray.flat();
  }

  async augmentFeature(feature: EventFeature): Promise<void> {
    for (const provider of this._attributeProviders) {
      // order is relevant. second provider can overwrite or use attributes of first provider.
      // eslint-disable-next-line no-await-in-loop
      await provider.augmentFeature(feature);
    }
  }

  toJSON(
    defaultOptions: AbstractFeatureProviderOptions = AbstractFeatureProvider.getDefaultOptions(),
  ): CompositeFeatureProviderOptions {
    const config: Partial<CompositeFeatureProviderOptions> = super.toJSON(
      defaultOptions,
    );

    config.featureProviders = this._featureProviders.map((fp) => fp.toJSON());
    config.attributeProviders = this._attributeProviders.map((ap) =>
      ap.toJSON(),
    );
    return config as CompositeFeatureProviderOptions;
  }
}
