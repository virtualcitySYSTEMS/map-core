import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from '../../../src/featureProvider/abstractFeatureProvider.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import { isProvidedFeature } from '../../../src/featureProvider/featureProviderSymbols.js';
import VectorStyleItem, {
  type VectorStyleItemOptions,
} from '../../../src/style/vectorStyleItem.js';
import { Layer } from '../../../index.js';

class TestFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TestFeatureProvider';
  }

  // eslint-disable-next-line class-methods-use-this
  getFeaturesByCoordinate(): Promise<Feature[]> {
    return Promise.resolve([]);
  }
}

describe('AbstractFeatureProvider', () => {
  describe('getting the provider feature', () => {
    let layer: Layer;

    before(() => {
      layer = new Layer({ name: 'testLayer' });
    });

    after(() => {
      layer.destroy();
    });

    describe('with a default provider', () => {
      let provider: TestFeatureProvider;
      let feature: Feature;

      before(() => {
        provider = new TestFeatureProvider({});
      });

      beforeEach(() => {
        feature = new Feature();
      });

      after(() => {
        provider.destroy();
      });

      it('should add the vcsLayerName', () => {
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature).to.have.property(vcsLayerName, layer.name);
      });

      it('should add the isProvidedFeature symbol', () => {
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature).to.have.property(isProvidedFeature, true);
      });

      it('should enforce a uuid', () => {
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature.getId()).to.be.a('string');
      });

      it('should not overwrite feature ids', () => {
        const id = 'test';
        feature.setId(id);
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature.getId()).to.equal(id);
      });
    });

    describe('with a configured style', () => {
      it('should add the style', () => {
        const style = new VectorStyleItem({});
        const provider = new TestFeatureProvider({
          style,
        });
        const providerFeature = provider.getProviderFeature(
          new Feature(),
          layer,
        );
        expect(providerFeature.getStyle()).to.equal(style.style);
        style.destroy();
        provider.destroy();
      });
    });

    describe('with configured vector properties', () => {
      let provider: TestFeatureProvider;
      let feature: Feature;

      before(() => {
        provider = new TestFeatureProvider({
          vectorProperties: {
            extrudedHeight: 20,
          },
        });
      });

      beforeEach(() => {
        feature = new Feature();
      });

      after(() => {
        provider.destroy();
      });

      it('should set the vector properties', () => {
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature.get('olcs_extrudedHeight')).to.equal(20);
      });

      it('should not overwrite set properties', () => {
        feature.set('olcs_extrudedHeight', 10);
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature.get('olcs_extrudedHeight')).to.equal(10);
      });

      it('should not overwrite nulled properties', () => {
        feature.set('olcs_extrudedHeight', null);
        const providerFeature = provider.getProviderFeature(feature, layer);
        expect(providerFeature.get('olcs_extrudedHeight')).to.be.null;
      });
    });
  });

  describe('getting the config', () => {
    describe('of a default feature provider', () => {
      it('should return the type', () => {
        const provider = new TestFeatureProvider({});
        const config = provider.toJSON();
        expect(config).to.have.all.keys(['type', 'name']);
        provider.destroy();
      });
    });

    describe('of a configured WMSLayer feature provider', () => {
      let inputConfig: AbstractFeatureProviderOptions;
      let outputConfig: AbstractFeatureProviderOptions;

      before(() => {
        inputConfig = {
          style: {
            type: VectorStyleItem.className,
            fill: { color: [255, 0, 255, 1] },
          },
          vectorProperties: {
            extrudedHeight: 20,
          },
        };
        const provider = new TestFeatureProvider(inputConfig);
        outputConfig = provider.toJSON();
        provider.destroy();
      });

      it('should configure the style', () => {
        expect(outputConfig)
          .to.have.property('style')
          .and.to.have.property('fill')
          .and.to.eql((inputConfig.style as VectorStyleItemOptions).fill);
      });

      it('should configure the vectorProperties', () => {
        expect(outputConfig)
          .to.have.property('vectorProperties')
          .and.to.eql(inputConfig.vectorProperties);
      });
    });
  });
});
