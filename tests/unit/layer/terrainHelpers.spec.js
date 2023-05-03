import nock from 'nock';
import { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import { getTerrainProviderForUrl } from '../../../src/layer/terrainHelpers.js';
import { setTerrainServer } from '../helpers/terrain/terrainData.js';

describe('terrainHelpers', () => {
  let scope;

  before(() => {
    scope = nock('http://localhost');
    setTerrainServer(scope);
  });

  after(() => {
    nock.cleanAll();
  });

  describe('~getTerrainProviderForUrl', () => {
    it('should create a new terrain provider, if non is present for the passed url', async () => {
      const TP = await getTerrainProviderForUrl('http://localhost/terrain', {});
      expect(TP).to.be.an.instanceOf(CesiumTerrainProvider);
    });

    it('it should return the previously created terrain provider', async () => {
      const createdCTP = await getTerrainProviderForUrl(
        'http://localhost/terrain',
        {},
      );
      const secondCTP = await getTerrainProviderForUrl(
        'http://localhost/terrain',
        {},
      );
      expect(createdCTP).to.equal(secondCTP);
    });

    it('should set the requestVertexNormals to true', async () => {
      const CTP = await getTerrainProviderForUrl('http://localhost/terrain', {
        requestVertexNormals: true,
      });
      expect(CTP).to.have.property('requestVertexNormals').and.to.be.true;
    });
  });
});
