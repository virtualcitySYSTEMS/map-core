import type { I3SNode, Cesium3DTileFeature } from '@vcmap-cesium/engine';
import { Cartesian3 } from '@vcmap-cesium/engine';
import sinon from 'sinon';
import type { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import { createDummyCesium3DTileFeature } from '../helpers/cesiumHelpers.js';
import '../../../src/cesium/cesium3DTileFeature.js';
import I3SAttributeProvider from '../../../src/featureProvider/i3sAttributeProvider.js';
import { i3sData } from '../../../src/layer/layerSymbols.js';
import { isProvidedFeature } from '../../../src/featureProvider/featureProviderSymbols.js';

describe('I3SAttributeProvider', () => {
  let sandbox: SinonSandbox;
  let provider: I3SAttributeProvider;
  let feature: Cesium3DTileFeature;
  let i3sNode: I3SNode;
  let loadFieldsStub: sinon.SinonStub;
  let getFieldsForFeatureStub: sinon.SinonStub;
  let getFieldsForPickedPositionStub: sinon.SinonStub;
  let setAttributeSpy: sinon.SinonSpy;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    loadFieldsStub = sandbox.stub().resolves();
    getFieldsForFeatureStub = sandbox.stub().returns({ attr: 'value' });
    getFieldsForPickedPositionStub = sandbox.stub().returns({ attr: 'value' });
    i3sNode = {
      loadFields: loadFieldsStub,
      getFieldsForFeature: getFieldsForFeatureStub,
      getFieldsForPickedPosition: getFieldsForPickedPositionStub,
    } as unknown as I3SNode;
    const tileset = { asset: { version: '1.0' } };
    feature = createDummyCesium3DTileFeature({}, tileset);
    // @ts-expect-error add i3sNode
    feature.content.tile = { i3sNode };
    setAttributeSpy = sandbox.spy(feature, 'setAttribute');
    provider = new I3SAttributeProvider({});
  });

  afterEach(() => {
    provider.destroy();
    sandbox.restore();
  });

  describe('augmentFeature', () => {
    it('should augment a feature with attributes from the i3s node', async () => {
      Object.defineProperty(feature, 'featureId', { value: 1 });
      await provider.augmentFeature(feature);
      expect(loadFieldsStub).to.have.been.called;
      expect(setAttributeSpy).to.have.been.calledWith('attr', 'value');
    });

    it('should not augment a feature if the i3s node is missing', async () => {
      // @ts-expect-error remove i3sNode
      delete feature.content.tile.i3sNode;
      await provider.augmentFeature(feature);
      expect(setAttributeSpy).to.not.have.been.called;
    });

    it('should not augment a feature if the i3s node fails to load fields', async () => {
      loadFieldsStub.rejects(new Error('failed'));
      await provider.augmentFeature(feature);
      expect(setAttributeSpy).to.not.have.been.called;
    });

    it('should not augment a feature if the i3s node returns no attributes', async () => {
      getFieldsForFeatureStub.returns(undefined);
      await provider.augmentFeature(feature);
      expect(setAttributeSpy).to.not.have.been.called;
    });
  });

  describe('augmentFeature with OpenLayers feature', () => {
    let olFeature: Feature;
    let cartesianPosition: Cartesian3;

    beforeEach(() => {
      olFeature = new Feature({});
      olFeature[isProvidedFeature] = true;
      olFeature.setId('test-id');
      cartesianPosition = new Cartesian3(1, 2, 3);
      olFeature[i3sData] = { i3sNode, cartesianPosition };
      olFeature.setGeometry(new Point([0, 0, 0]));
    });

    it('should augment an ol feature with attributes from the i3s node using cartesian position', async () => {
      await provider.augmentFeature(olFeature);
      expect(loadFieldsStub).to.have.been.called;
      expect(getFieldsForPickedPositionStub).to.have.been.calledWith(
        cartesianPosition,
      );
      expect(olFeature.get('attr')).to.equal('value');
    });

    it('should not augment an ol feature if the i3s node is missing', async () => {
      olFeature[i3sData] = {
        i3sNode: undefined as unknown as I3SNode,
        cartesianPosition,
      };
      await provider.augmentFeature(olFeature);
      expect(getFieldsForPickedPositionStub).to.not.have.been.called;
    });

    it('should not augment an ol feature if the cartesian position is missing', async () => {
      olFeature[i3sData] = { i3sNode, cartesianPosition: undefined };
      await provider.augmentFeature(olFeature);
      expect(getFieldsForPickedPositionStub).to.not.have.been.called;
    });

    it('should not augment an ol feature if the i3s node fails to load fields', async () => {
      loadFieldsStub.rejects(new Error('failed'));
      await provider.augmentFeature(olFeature);
      expect(olFeature.get('attr')).to.be.undefined;
    });

    it('should not augment an ol feature if the i3s node returns no attributes', async () => {
      getFieldsForPickedPositionStub.returns(undefined);
      await provider.augmentFeature(olFeature);
      expect(olFeature.get('attr')).to.be.undefined;
    });

    it('should not augment an ol feature if it is not marked as a provided feature', async () => {
      delete olFeature[isProvidedFeature];
      await provider.augmentFeature(olFeature);
      expect(getFieldsForPickedPositionStub).to.not.have.been.called;
    });
  });
});
