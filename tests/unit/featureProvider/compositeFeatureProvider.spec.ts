import Feature from 'ol/Feature.js';
import { expect } from 'chai';
import { CompositeFeatureProvider } from '../../../index.js';
import TestAttributeProvider from './testAttributeProvider.js';

describe('CompositeFeatureProvider', () => {
  describe('augmenting a feature', () => {
    let provider: CompositeFeatureProvider;
    let feature: Feature;

    before(async () => {
      const childProvider1 = new TestAttributeProvider(1);
      const childProvider2 = new TestAttributeProvider(2);
      provider = new CompositeFeatureProvider({
        featureProviders: [],
        attributeProviders: [childProvider1, childProvider2],
      });
      feature = new Feature();
      feature.setId('feature1');
      await provider.augmentFeature(feature);
    });

    after(() => {
      provider.destroy();
    });

    it('should set the augmented attributes from all child providers, overwritting in order', () => {
      expect(feature.get('testAttribute')).to.equal(2);
    });
  });
});
