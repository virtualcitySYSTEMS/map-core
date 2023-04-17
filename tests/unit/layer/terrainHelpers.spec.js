import { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import { getTerrainProviderForUrl } from '../../../src/layer/terrainHelpers.js';

describe('terrainHelpers', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('~getTerrainProviderForUrl', () => {
    beforeEach(() => {
      sandbox.useFakeServer();
      sandbox.server.respondWith(/test/, JSON.stringify({}));
    });

    it('should create a new terrain provider, if non is present for the passed url', () => {
      const TP = getTerrainProviderForUrl({ url: 'test' });
      expect(TP).to.be.an.instanceOf(CesiumTerrainProvider);
    });

    it('it should return the previously created terrain provider', () => {
      const createdCTP = getTerrainProviderForUrl({ url: 'test1' });
      const secondCTP = getTerrainProviderForUrl({ url: 'test1' });
      expect(createdCTP).to.equal(secondCTP);
    });

    it('should set the requestVertexNormals to true', () => {
      const CTP = getTerrainProviderForUrl({
        url: 'test2',
        requestVertexNormals: true,
      });
      expect(CTP).to.have.property('requestVertexNormals').and.to.be.true;
    });
  });
});
