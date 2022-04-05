import { Cesium3DTileStyle } from '@vcmap/cesium';
import PointCloudLayer from '../../../../src/layer/pointCloudLayer.js';
import { createTilesetServer, setCesiumMap } from '../../helpers/cesiumHelpers.js';
import VcsApp from '../../../../src/vcsApp.js';

describe('PointCloudCesiumImpl', () => {
  let sandbox;
  /** @type {import("@vcmap/core").PointCloudCesiumImpl} */
  let PCL;
  let app;
  let pointCloud;
  let map;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    map = await setCesiumMap(app);
    pointCloud = new PointCloudLayer({ url: 'http://test.com/tileset.json' });
    app.layers.add(pointCloud);
  });

  beforeEach(() => {
    createTilesetServer(sandbox);
    [PCL] = pointCloud.getImplementationsForMap(map);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('initialize', () => {
    it('should set the current point size', async () => {
      PCL.pointSize = 3;
      await PCL.initialize();
      expect(PCL.cesium3DTileset)
        .to.have.property('style')
        .and.to.have.property('pointSize')
        .and.to.have.property('expression', '3');
    });
  });

  describe('updatePointSize', () => {
    beforeEach(async () => {
      await PCL.initialize();
    });

    it('should assign a current cesium3DTileset style the _pointSize', () => {
      const style = new Cesium3DTileStyle({ show: true });
      PCL.cesium3DTileset.style = style;
      PCL.updatePointSize(3);
      expect(style).to.have.property('pointSize')
        .and.to.have.property('expression', '3');
    });

    it('should set style dirty, if assigning a new pointSize', () => {
      PCL.cesium3DTileset.style = new Cesium3DTileStyle({ show: true });
      const makeStyleDirty = sandbox.spy(PCL.cesium3DTileset, 'makeStyleDirty');
      PCL.updatePointSize(3);
      expect(makeStyleDirty).to.have.been.called;
    });

    it('should create a style, if none is present on the tileset', () => {
      PCL.updatePointSize(3);

      expect(PCL.cesium3DTileset)
        .to.have.property('style')
        .to.have.property('pointSize')
        .and.to.have.property('expression', '3');
    });
  });
});
