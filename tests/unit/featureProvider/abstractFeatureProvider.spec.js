import Feature from 'ol/Feature.js';
import AbstractFeatureProvider from '../../../src/featureProvider/abstractFeatureProvider.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import { isProvidedFeature } from '../../../src/featureProvider/featureProviderSymbols.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';

describe('AbstractFeatureProvider', () => {
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

    describe('with a configured style', () => {
      it('should add the style', () => {
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
        const config = provider.toJSON();
        expect(config).to.have.all.keys(['type']);
        provider.destroy();
      });
    });

    describe('of a configured WMSLayer feature provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          style: {
            type: VectorStyleItem.className,
            fill: { color: [255, 0, 255, 1] },
          },
          vectorProperties: {
            extrudedHeight: 20,
          },
          showGeometry: true,
        };
        const provider = new AbstractFeatureProvider(layerName, inputConfig);
        outputConfig = provider.toJSON();
        provider.destroy();
      });

      it('should configure the showGeometry', () => {
        expect(outputConfig).to.have.property(
          'showGeometry',
          inputConfig.showGeometry,
        );
      });

      it('should configure the style', () => {
        expect(outputConfig)
          .to.have.property('style')
          .and.to.have.property('fill')
          .and.to.eql(inputConfig.style.fill);
      });

      it('should configure the vectorProperties', () => {
        expect(outputConfig)
          .to.have.property('vectorProperties')
          .and.to.eql(inputConfig.vectorProperties);
      });
    });
  });
});
