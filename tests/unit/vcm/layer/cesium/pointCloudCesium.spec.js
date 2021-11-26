import { Cesium3DTileStyle } from '@vcmap/cesium';
import PointCloud from '../../../../../src/vcs/vcm/layer/pointCloud.js';
import { createTilesetServer, setCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { getFramework } from '../../../helpers/framework.js';
import resetFramework from '../../../helpers/resetFramework.js';

describe('vcs.vcm.layer.cesium.PointCloudCesium', () => {
  let sandbox;
  /** @type {import("@vcmap/core").PointCloudCesium} */
  let PCL;
  let pointCloud;
  let map;

  before(async () => {
    sandbox = sinon.createSandbox();
    map = await setCesiumMap(getFramework());
    pointCloud = new PointCloud({ url: 'http://test.com/tileset.json' });
    getFramework().addLayer(pointCloud);
  });

  beforeEach(() => {
    createTilesetServer(sandbox);
    [PCL] = pointCloud.getImplementationsForMap(map);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    resetFramework();
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
