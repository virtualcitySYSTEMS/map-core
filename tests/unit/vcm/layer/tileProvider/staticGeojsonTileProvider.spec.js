import axios from 'axios';
import Feature from 'ol/Feature.js';
import StaticGeojsonTileProvider from '../../../../../src/vcs/vcm/layer/tileProvider/staticGeojsonTileProvider.js';
import testGeoJSON from '../testGeoJSON.json';


describe('vcs.vcm.layer.tileProvider.StaticGeojsonTileProvider', () => {
  let sandbox;
  let axiosStub;
  /** @type {import("@vcmap/core").StaticGeojsonTileProvider} */
  let tileProvider;

  before(() => {
    sandbox = sinon.createSandbox();
    tileProvider = new StaticGeojsonTileProvider({
      url: 'testURL',
      tileCacheSize: 10,
      baseLevels: [10],
    });
  });

  beforeEach(() => {
    axiosStub = sandbox.stub(axios, 'get').resolves({
      data: testGeoJSON.featureCollection,
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    tileProvider.destroy();
  });

  describe('constructor', () => {
    it('should set baseLevels to 0', () => {
      expect(tileProvider.baseLevels).to.have.members([0]);
    });
  });

  describe('loader', () => {
    it('should request data with given url', async () => {
      await tileProvider.loader(1, 2, 3);
      expect(axiosStub).to.have.been.calledWith('testURL');
    });

    it('should return parsed features', async () => {
      const features = await tileProvider.loader(1, 2, 3);
      expect(features).to.have.lengthOf(2);
      expect(features[0]).to.be.instanceOf(Feature);
    });
  });
});
