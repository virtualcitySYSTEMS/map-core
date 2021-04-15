import axios from 'axios';
import URLTemplateTileProvider from '../../../../../src/vcs/vcm/layer/tileProvider/urlTemplateTileProvider.js';
import resetFramework from '../../../helpers/resetFramework.js';
import { setCurrentLocale } from '../../../../../src/vcs/vcm/util/locale.js';

describe('vcs.vcm.layer.tileProvider.URLTemplateTileProvider', () => {
  let sandbox;
  let axiosStub;
  /** @type {vcs.vcm.layer.tileProvider.URLTemplateTileProvider} */
  let tileProvider;

  before(async () => {
    sandbox = sinon.createSandbox();
    tileProvider = new URLTemplateTileProvider({
      url: 'testURL',
      tileCacheSize: 10,
      baseLevels: [10],
    });
  });

  beforeEach(() => {
    axiosStub = sandbox.stub(axios, 'get').resolves({ data: {} });
  });

  afterEach(() => {
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

    it('should replace locale placeholder in requested url', async () => {
      tileProvider.url = '{locale}';
      setCurrentLocale('nl');
      await tileProvider.loader(1, 2, 3);
      expect(axiosStub).to.have.been.calledWith('nl');
    });

    it('should replace extent placeholder in requested url', async () => {
      tileProvider.url = '{minx},{miny},{maxx},{maxy}';
      await tileProvider.loader(1, 2, 3);
      expect(axiosStub).to.have.been.calledWith('-135,40.979898069620134,-90,66.51326044311185');
    });
  });
});
