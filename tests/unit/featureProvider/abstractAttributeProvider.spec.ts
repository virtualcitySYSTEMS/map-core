import Feature from 'ol/Feature.js';
import { expect } from 'chai';
import TestAttributeProvider from './testAttributeProvider.js';

describe('AbstractAttributeProvider', () => {
  describe('augmenting a feature', () => {
    let provider: TestAttributeProvider;
    let feature: Feature;

    beforeEach(() => {
      let callCount = 0;
      provider = new TestAttributeProvider(() => {
        callCount += 1;
        return callCount;
      });
      feature = new Feature();
      feature.setId('feature1');
    });

    afterEach(() => {
      provider.destroy();
    });

    it('should augment a single feature', async () => {
      await provider.augmentFeature(feature);
      expect(feature.get('testAttribute')).to.equal(1);
    });

    it('should augment multiple features', async () => {
      const feature2 = new Feature();
      feature2.setId('feature2');
      await provider.augmentFeatures([feature, feature2]);
      expect(feature.get('testAttribute')).to.equal(1);
      expect(feature2.get('testAttribute')).to.equal(2);
    });

    it('should not augment a feature twice', async () => {
      await provider.augmentFeature(feature);
      await provider.augmentFeature(feature);

      expect(feature.get('testAttribute')).to.equal(1);
    });

    it('should not augment features that are already augmented', async () => {
      const feature2 = new Feature();
      feature2.setId('feature2');

      await provider.augmentFeature(feature);
      await provider.augmentFeatures([feature, feature2]);

      expect(feature.get('testAttribute')).to.equal(1);
      expect(feature2.get('testAttribute')).to.equal(2);
    });

    it('should not augment a feature without an ID, even if it receives an id later on', async () => {
      const noIdFeature = new Feature();
      await provider.augmentFeature(noIdFeature);
      expect(noIdFeature.get('testAttribute')).to.be.undefined;
      noIdFeature.setId('newId');
      await provider.augmentFeature(noIdFeature);
      expect(noIdFeature.get('testAttribute')).to.be.undefined;
    });
  });

  describe('handling of key property', () => {
    let provider: TestAttributeProvider;

    beforeEach(() => {
      let callCount = 0;
      provider = new TestAttributeProvider(
        () => {
          callCount += 1;
          return callCount;
        },
        {
          name: 'TestProvider',
          keyProperty: 'customId',
        },
      );
    });

    afterEach(() => {
      provider.destroy();
    });

    it('should use custom key property to retrieve attributes', async () => {
      const feature = new Feature();
      feature.set('customId', 'feature123');

      await provider.augmentFeature(feature);
      expect(feature.get('testAttribute')).to.equal(1);
    });

    it('should ignore features without the key property', async () => {
      const feature = new Feature();
      feature.setId('feature123');
      await provider.augmentFeature(feature);
      expect(feature.get('testAttribute')).to.be.undefined;
    });

    it('should handle bulk augmentation with missing keys', async () => {
      const feature1 = new Feature();
      feature1.set('customId', 'feature1');
      const feature2 = new Feature();
      feature2.setId('feature2'); // Missing customId

      await provider.augmentFeatures([feature1, feature2]);
      expect(feature1.get('testAttribute')).to.equal(1);
      expect(feature2.get('testAttribute')).to.be.undefined;
    });
  });

  describe('serialization', () => {
    describe('of an unconfigured provider', () => {
      let provider: TestAttributeProvider;

      beforeEach(() => {
        let callCount = 0;
        provider = new TestAttributeProvider(() => {
          callCount += 1;
          return callCount;
        });
      });

      afterEach(() => {
        provider.destroy();
      });

      it('should serialize to JSON correctly', () => {
        const config = provider.toJSON();
        expect(config).to.have.all.keys(['type', 'name']);
      });
    });

    describe('of a configured provider', () => {
      let provider: TestAttributeProvider;

      beforeEach(() => {
        let callCount = 0;
        provider = new TestAttributeProvider(
          () => {
            callCount += 1;
            return callCount;
          },
          {
            name: 'ConfiguredProvider',
            keyProperty: 'customKey',
          },
        );
      });

      afterEach(() => {
        provider.destroy();
      });

      it('should serialize to JSON correctly', () => {
        const config = provider.toJSON();
        expect(config).to.deep.equal({
          type: TestAttributeProvider.className,
          name: 'ConfiguredProvider',
          keyProperty: 'customKey',
        });
      });
    });
  });
});
