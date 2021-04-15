import Feature from 'ol/Feature.js';
import AbstractFeatureProvider from '../../../../../src/vcs/vcm/util/featureProvider/abstractFeatureProvider.js';
import { vcsLayerName } from '../../../../../src/vcs/vcm/layer/layerSymbols.js';
import {
  isProvidedFeature,
  showProvidedFeature,
} from '../../../../../src/vcs/vcm/util/featureProvider/featureProviderSymbols.js';
import VectorStyleItem from '../../../../../src/vcs/vcm/util/style/vectorStyleItem.js';

describe('vcs.vcm.util.featureProvider.AbstractFeatureProvider', () => {
  let layerName;

  before(() => {
    layerName = 'test';
  });

  describe('getting the provider feature', () => {
    describe('with a default provider', () => {
      let provider;
      let feature;

      before(() => {
        provider = new AbstractFeatureProvider(layerName, {});
      });

      beforeEach(() => {
        feature = new Feature();
      });

      after(() => {
        provider.destroy();
      });

      it('should add the vcsLayerName', () => {
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature).to.have.property(vcsLayerName, layerName);
      });

      it('should add the isProvidedFeature symbol', () => {
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature).to.have.property(isProvidedFeature, true);
      });

      it('should add the showProvidedFeature symbol', () => {
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature).to.have.property(showProvidedFeature, provider.showGeometry);
      });

      it('should enforce a uuid', () => {
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature.getId()).to.be.a('string');
      });

      it('should not overwrite feature ids', () => {
        const id = 'test';
        feature.setId(id);
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature.getId()).to.equal(id);
      });
    });

    describe('with configured generic feature properties', () => {
      it('should add the generic feature properties', () => {
        const provider = new AbstractFeatureProvider(layerName, {
          genericFeatureProperties: { foo: 'bar' },
        });
        const providerFeature = provider.getProviderFeature(new Feature());
        expect(providerFeature.get('foo')).to.equal('bar');
        provider.destroy();
      });
    });

    describe('with a configured style', () => {
      it('should add the generic feature properties', () => {
        const style = new VectorStyleItem({});
        const provider = new AbstractFeatureProvider(layerName, {
          style,
        });
        const providerFeature = provider.getProviderFeature(new Feature());
        expect(providerFeature.getStyle()).to.equal(style.style);
        style.destroy();
        provider.destroy();
      });
    });

    describe('with configured vector properties', () => {
      let provider;
      let feature;

      before(() => {
        provider = new AbstractFeatureProvider(layerName, {
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
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature.get('olcs_extrudedHeight')).to.equal(20);
      });

      it('should not overwrite set properties', () => {
        feature.set('olcs_extrudedHeight', 10);
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature.get('olcs_extrudedHeight')).to.equal(10);
      });

      it('should not overwrite nulled properties', () => {
        feature.set('olcs_extrudedHeight', null);
        const providerFeature = provider.getProviderFeature(feature);
        expect(providerFeature.get('olcs_extrudedHeight')).to.be.null;
      });
    });
  });

  describe('getting the config', () => {
    describe('of a default feature provider', () => {
      it('should return the type', () => {
        const provider = new AbstractFeatureProvider(layerName, {});
        const config = provider.getConfigObject();
        expect(config).to.have.all.keys(['type']);
        provider.destroy();
      });
    });

    describe('of a configured WMS feature provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          style: {
            fill: { color: [255, 0, 255, 1] },
          },
          vectorProperties: {
            extrudedHeight: 20,
          },
          showGeometry: true,
          genericFeatureProperties: {
            foo: 'bar',
          },
        };
        const provider = new AbstractFeatureProvider(layerName, inputConfig);
        outputConfig = provider.getConfigObject();
        provider.destroy();
      });

      it('should configure the showGeometry', () => {
        expect(outputConfig).to.have.property('showGeometry', inputConfig.showGeometry);
      });

      it('should configure the style', () => {
        expect(outputConfig).to.have.property('style')
          .and.to.have.property('fill')
          .and.to.eql(inputConfig.style.fill);
      });

      it('should configure the vectorProperties', () => {
        expect(outputConfig).to.have.property('vectorProperties')
          .and.to.eql(inputConfig.vectorProperties);
      });

      it('should configure the genericFeatureProperties', () => {
        expect(outputConfig).to.have.property('genericFeatureProperties')
          .and.to.eql(inputConfig.genericFeatureProperties);
      });
    });
  });
});
