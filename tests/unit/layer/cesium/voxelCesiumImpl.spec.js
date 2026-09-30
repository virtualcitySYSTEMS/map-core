import {
  Cartesian3,
  Cesium3DTilesVoxelProvider,
  Matrix4,
  MetadataComponentType,
  MetadataType,
  VoxelPrimitive,
  VoxelShapeType,
} from '@vcmap-cesium/engine';
import VoxelLayer from '../../../../src/layer/voxelLayer.js';
import VcsApp from '../../../../src/vcsApp.js';
import {
  allowPicking,
  vcsLayerName,
} from '../../../../src/layer/layerSymbols.js';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';

function createProvider() {
  return {
    shape: VoxelShapeType.BOX,
    dimensions: new Cartesian3(2, 2, 2),
    paddingBefore: Cartesian3.ZERO,
    paddingAfter: Cartesian3.ZERO,
    names: ['value'],
    types: [MetadataType.SCALAR],
    componentTypes: [MetadataComponentType.FLOAT32],
    minimumValues: [[0]],
    maximumValues: [[1]],
    availableLevels: 1,
    maximumTileCount: 1,
    globalTransform: Matrix4.IDENTITY,
    shapeTransform: Matrix4.IDENTITY,
    requestData: () => undefined,
  };
}

describe('VoxelCesiumImpl', () => {
  let app;
  let cesiumMap;
  let voxelLayer;
  let voxelImpl;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    sandbox
      .stub(Cesium3DTilesVoxelProvider, 'fromUrl')
      .resolves(createProvider());
    voxelLayer = new VoxelLayer({
      url: 'http://test.com/voxels.json',
      modelMatrix: Matrix4.fromUniformScale(2),
      screenSpaceError: 2,
    });
    app.layers.add(voxelLayer);
    [voxelImpl] = voxelLayer.getImplementationsForMap(cesiumMap);
  });

  afterEach(() => {
    voxelLayer.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  it('loads and registers a hidden VoxelPrimitive', async () => {
    await voxelImpl.initialize();

    expect(voxelImpl.voxelPrimitive).to.be.instanceof(VoxelPrimitive);
    expect(voxelImpl.voxelPrimitive).to.have.property('show', false);
    expect(voxelImpl.voxelPrimitive).to.have.property('screenSpaceError', 2);
    expect(voxelImpl.voxelPrimitive).to.have.property(
      vcsLayerName,
      voxelImpl.name,
    );
    expect(voxelImpl.voxelPrimitive).to.have.property(allowPicking, true);
    expect(cesiumMap.getVisualizationsForLayer(voxelLayer)).to.include(
      voxelImpl.voxelPrimitive,
    );
  });

  it('updates the primitive screen space error', async () => {
    await voxelImpl.initialize();

    voxelLayer.screenSpaceError = 8;

    expect(voxelLayer.screenSpaceError).to.equal(8);
    expect(voxelImpl.voxelPrimitive).to.have.property('screenSpaceError', 8);
  });

  it('shows and hides the primitive with activation', async () => {
    await voxelImpl.activate();
    expect(voxelImpl.voxelPrimitive).to.have.property('show', true);

    voxelImpl.deactivate();
    expect(voxelImpl.voxelPrimitive).to.have.property('show', false);
  });
});
