import axios from 'axios';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import resetFramework from '../../../helpers/resetFramework.js';
import MVTTileProvider from '../../../../../src/vcs/vcm/layer/tileProvider/mvtTileProvider.js';

describe('vcs.vcm.layer.tileProvider.MVTTileProvider', () => {
  let sandbox;
  let axiosStub;
  let featureNorthEast;
  let featureSouthWest;
  /** @type {import("@vcmap/core").MVTTileProvider} */
  let tileProvider;

  before(() => {
    sandbox = sinon.createSandbox();
    tileProvider = new MVTTileProvider({
      url: 'testURL',
      tileCacheSize: 10,
      baseLevels: [0],
      idProperty: 'idProp',
    });
  });

  beforeEach(() => {
    featureSouthWest = new Feature({ idProp: 'test1', geometry: new Point([0, 0]) });
    featureNorthEast = new Feature({ idProp: undefined, geometry: new Point([4096, 4096]) });
    axiosStub = sandbox.stub(axios, 'get').resolves({ data: undefined });
    sandbox.stub(tileProvider._MVTFormat, 'readFeatures').returns([featureNorthEast, featureSouthWest]);
  });

  afterEach(async () => {
    await tileProvider.clearCache();
    sandbox.restore();
  });

  after(() => {
    tileProvider.destroy();
    resetFramework();
  });

  describe('loader', () => {
    it('should request data with url', async () => {
      tileProvider.url = 'myURL';
      await tileProvider.loader(1, 2, 3);
      expect(axiosStub).to.have.been.calledWith('myURL');
    });

    it('should replace tile coordinates placeholder in requested url', async () => {
      tileProvider.url = '{x},{y},{z}';
      await tileProvider.loader(1, 2, 3);
      expect(axiosStub).to.have.been.calledWith('1,2,3');
    });

    it('should apply id Property as featureId', async () => {
      await tileProvider.getFeaturesForTile(0, 0, 0);
      expect(featureSouthWest.getId()).to.equal('test1');
    });

    it('should only apply id Property as featureId if set', async () => {
      await tileProvider.getFeaturesForTile(0, 0, 0);
      expect(featureNorthEast.getId()).to.not.equal('test1');
    });

    it('should transform local coordinates from southWest Corner to mercator', async () => {
      await tileProvider.getFeaturesForTile(0, 0, 0);
      expect(featureSouthWest.getGeometry().getFirstCoordinate())
        .to.have.members([-20037508.342789244, 20037508.34278924]);
    });

    it('should transform local coordinates from northEath Corner to mercator', async () => {
      await tileProvider.getFeaturesForTile(0, 0, 0);
      expect(featureNorthEast.getGeometry().getFirstCoordinate())
        .to.have.members([20037508.342789244, -20037508.342789255]);
    });
  });
});
