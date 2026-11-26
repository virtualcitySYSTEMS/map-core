import { expect } from 'chai';
import sinon from 'sinon';
import OGCMapLayer, {
  type OGCMapOptions,
} from '../../../src/layer/ogcMapLayer.js';

describe('OGCMapLayer', () => {
  let sandbox: sinon.SinonSandbox;
  let layer: OGCMapLayer;
  const datetime = '2026-10-23T00:00:00Z';

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    layer = new OGCMapLayer({});
  });

  afterEach(() => {
    layer.destroy();
    sandbox.restore();
  });

  describe('toJSON', () => {
    it('should only serialize type and name for a default layer', () => {
      expect(layer.toJSON()).to.deep.equal({
        name: layer.name,
        type: OGCMapLayer.className,
      });
    });

    it('should serialize configured options', () => {
      const options: OGCMapOptions = {
        name: 'configured',
        url: 'http://localhost/collections/maps',
        singleImage2d: true,
        styleId: 'night',
        tileSize: [512, 128],
        parameters: {
          datetime,
          collections: 'buildings,trees',
          transparent: 'false',
          properties: ['one', 'two'],
        },
      };
      layer.destroy();
      layer = new OGCMapLayer(options);

      expect(layer.toJSON()).to.deep.equal({
        ...options,
        type: OGCMapLayer.className,
      });
    });

    it('should return independent copies of mutable options', () => {
      sandbox.stub(layer, 'reload').resolves();
      layer.tileSize = [512, 128];
      layer.parameters = { style: 'default', properties: ['one', 'two'] };
      const config = layer.toJSON();

      expect(config.tileSize).to.deep.equal(layer.tileSize);
      expect(config.tileSize).to.not.equal(layer.tileSize);
      expect(config.parameters).to.deep.equal(layer.parameters);
      expect(config.parameters).to.not.equal(layer.parameters);
      expect(config.parameters?.properties).to.not.equal(
        layer.parameters.properties,
      );
    });
  });

  describe('request options', () => {
    it('should reload when request options are replaced', () => {
      const reload = sandbox.stub(layer, 'reload').resolves();

      layer.styleId = 'night';
      layer.parameters = { collections: 'buildings', transparent: 'false' };

      expect(reload.callCount).to.equal(2);
      const options = layer.getImplementationOptions();
      expect(options.styleId).to.equal('night');
      expect(options.parameters).to.deep.equal({
        collections: 'buildings',
        transparent: 'false',
      });
    });

    it('should not reload when request options are unchanged', () => {
      const reload = sandbox.stub(layer, 'reload').resolves();
      layer.styleId = 'night';
      layer.parameters = { collections: 'buildings' };
      reload.resetHistory();

      layer.styleId = 'night';
      layer.parameters = { collections: 'buildings' };

      expect(reload).to.not.have.been.called;
    });

    it('should return a copy of the parameters', () => {
      sandbox.stub(layer, 'reload').resolves();
      layer.parameters = { collections: 'buildings', properties: ['one'] };
      const { parameters } = layer;
      parameters.collections = 'trees';
      (parameters.properties as string[]).push('two');

      expect(layer.parameters).to.not.equal(layer.parameters);
      expect(layer.parameters).to.deep.equal({
        collections: 'buildings',
        properties: ['one'],
      });
    });

    it('should pass a copy of the parameters to the implementations', () => {
      sandbox.stub(layer, 'reload').resolves();
      layer.parameters = { collections: 'buildings' };
      const { parameters } = layer.getImplementationOptions();
      parameters.collections = 'trees';

      expect(layer.parameters).to.deep.equal({ collections: 'buildings' });
    });

    it('should reload when changing and reassigning the parameters', () => {
      const reload = sandbox.stub(layer, 'reload').resolves();
      const { parameters } = layer;
      parameters.datetime = datetime;
      layer.parameters = parameters;

      expect(reload).to.have.been.calledOnce;
      expect(layer.parameters).to.deep.equal({ datetime });
      expect(layer.getImplementationOptions().parameters).to.deep.equal({
        datetime,
      });
    });

    it('should log reload errors and restore the previous parameters', async () => {
      const error = new Error('reload failed');
      sandbox.stub(layer, 'reload').rejects(error);
      const log = sandbox.stub(layer.getLogger(), 'error');
      layer.parameters = { collections: 'buildings' };
      await Promise.resolve();
      expect(layer.parameters).to.deep.equal({});
      expect(log).to.have.been.calledWith(
        'failed to reload after parameters setting',
        error,
      );
    });
  });
});
