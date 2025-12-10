import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from './abstractFeatureProvider.js';
import AbstractAttributeProvider, {
  type AbstractAttributeProviderOptions,
} from './abstractAttributeProvider.js';
import { featureProviderClassRegistry } from '../classRegistry.js';

export function getProviderForOption(
  options?:
    | AbstractFeatureProviderOptions
    | AbstractAttributeProviderOptions
    | AbstractAttributeProvider
    | AbstractFeatureProvider,
): AbstractFeatureProvider | AbstractAttributeProvider | undefined {
  if (
    options instanceof AbstractFeatureProvider ||
    options instanceof AbstractAttributeProvider
  ) {
    return options;
  }

  if (options?.type) {
    const CTOR = featureProviderClassRegistry.getClass(options.type);
    if (CTOR) {
      return new CTOR(options);
    }
  }

  return undefined;
}
