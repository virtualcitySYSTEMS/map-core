import {
  BoundingSphere,
  Cartesian3,
  CustomShader,
  Matrix4,
} from '@vcmap-cesium/engine';
import Circle from 'ol/geom/Circle.js';
import VoxelLayer from '../../../src/layer/voxelLayer.js';
import Projection from '../../../src/util/projection.js';
import VcsApp from '../../../src/vcsApp.js';
import { setCesiumMap } from '../helpers/cesiumHelpers.js';

describe('VoxelLayer', () => {
  let app;
  let cesiumMap;
  let voxelLayer;

  before(async () => {
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    voxelLayer = new VoxelLayer({ url: 'http://test.com/voxels.json' });
  });

  afterEach(() => {
    voxelLayer.destroy();
  });

  after(() => {
    app.destroy();
  });

  it('serializes only the stable layer configuration', () => {
    const config = voxelLayer.toJSON();
    expect(config).to.have.all.keys('name', 'type', 'url');
  });

  it('serializes a non-default screen space error', () => {
    const configuredLayer = new VoxelLayer({
      url: 'http://test.com/voxels.json',
      screenSpaceError: 2,
    });

    expect(configuredLayer.toJSON()).to.include({ screenSpaceError: 2 });
    configuredLayer.destroy();
  });

  it('keeps custom shaders and model matrices as runtime options', () => {
    const customShader = new CustomShader({});
    const modelMatrix = Matrix4.fromUniformScale(2);
    const configuredLayer = new VoxelLayer({
      url: 'http://test.com/voxels.json',
      customShader,
      modelMatrix,
    });

    expect(configuredLayer.customShader).to.equal(customShader);
    expect(configuredLayer.modelMatrix).to.equal(modelMatrix);
    expect(configuredLayer.toJSON()).to.not.have.any.keys(
      'customShader',
      'modelMatrix',
    );
    configuredLayer.destroy();
  });

  it('creates implementations only for Cesium maps', () => {
    expect(voxelLayer.getImplementationsForMap(cesiumMap)).to.have.length(1);
  });

  it('returns a configured extent before deriving one from the primitive', () => {
    const configuredLayer = new VoxelLayer({
      url: 'http://test.com/voxels.json',
      extent: {
        coordinates: [0, 0, 1, 1],
      },
    });

    expect(configuredLayer.getZoomToExtent()).to.equal(configuredLayer.extent);
    expect(configuredLayer.toJSON()).to.have.property('extent');
    configuredLayer.destroy();
  });

  it('derives an extent from the voxel primitive bounding sphere', () => {
    const [implementation] = voxelLayer.getImplementationsForMap(cesiumMap);
    implementation.voxelPrimitive = {
      boundingSphere: new BoundingSphere(Cartesian3.fromDegrees(1, 1), 10),
    };

    const extent = voxelLayer.getZoomToExtent();
    const expectedExtent = new Circle(
      Projection.wgs84ToMercator([1, 1]),
      10,
    ).getExtent();

    expect(extent.extent.map((coordinate) => Math.floor(coordinate))).to.eql(
      expectedExtent.map((coordinate) => Math.floor(coordinate)),
    );
    implementation.voxelPrimitive = undefined;
  });

  it('returns null if no voxel primitive is available', () => {
    expect(voxelLayer.getZoomToExtent()).to.be.null;
  });
});
