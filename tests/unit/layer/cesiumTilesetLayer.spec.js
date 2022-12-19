import {
  Matrix4,
  BoundingSphere,
  Cartesian3,
  Math as CesiumMath,
  Rectangle,
  Cesium3DTileFeature,
} from '@vcmap/cesium';
import Circle from 'ol/geom/Circle.js';
import CesiumTilesetLayer from '../../../src/layer/cesiumTilesetLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import getDummyCesium3DTileset from './cesium/getDummyCesium3DTileset.js';
import Projection, { wgs84Projection } from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';
import { createTilesetServer, setCesiumMap, createDummyCesium3DTileFeature } from '../helpers/cesiumHelpers.js';
import { VectorStyleItem } from '../../../index.js';

describe('CesiumTilesetLayer', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").CesiumTilesetLayer} */
  let cesiumTileset;
  /** @type {import("@vcmap/core").CesiumMap} */
  let cesiumMap;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    createTilesetServer(sandbox);
    cesiumTileset = new CesiumTilesetLayer({ url: 'http://test.com/tileset.json' });
  });

  afterEach(() => {
    cesiumTileset.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('constructor', () => {
    it('should add tileset.json to a url not ending on .json', () => {
      const cesiumTileset1 = new CesiumTilesetLayer({ url: 'test' });
      expect(cesiumTileset1).to.have.property('url', 'test/tileset.json');
      cesiumTileset1.destroy();
    });

    it('should not tileset.json to an url ending on .json', () => {
      const cesiumTileset1 = new CesiumTilesetLayer({ url: 'test/tileset2.json' });
      expect(cesiumTileset1).to.have.property('url', 'test/tileset2.json');
      cesiumTileset1.destroy();
    });
  });

  describe('modelMatrix', () => {
    let matrix;

    before(() => {
      matrix = Matrix4.IDENTITY;
    });

    it('should return the model matrix', () => {
      cesiumTileset.modelMatrix = matrix;
      expect(cesiumTileset.modelMatrix).to.equal(matrix);
    });

    it('should update the model matrix of its implementations', () => {
      const [impl] = cesiumTileset.getImplementationsForMap(cesiumMap);
      cesiumTileset.modelMatrix = matrix;
      expect(impl.modelMatrix).to.equal(matrix);
    });
  });

  describe('offset', () => {
    let offset;

    before(() => {
      offset = [0, 0, 20];
    });

    it('should return the offset', () => {
      cesiumTileset.offset = offset;
      expect(cesiumTileset.offset).to.equal(offset);
    });

    it('should update the offset of its implementations', () => {
      const [impl] = cesiumTileset.getImplementationsForMap(cesiumMap);
      cesiumTileset.offset = offset;
      expect(impl.offset).to.equal(offset);
    });
  });

  describe('objectClickHandler', () => {
    it('should return an object with id and feature if allowPicking', () => {
      const feature = createDummyCesium3DTileFeature({ id: 'test', test: true });
      const object = cesiumTileset.objectClickedHandler(feature);

      expect(object).to.deep.equal({
        feature: { gmlId: 'test', clickedPosition: {}, id: 'test', test: true },
        id: feature.getId(),
      });
    });

    it('should not raise feature event and return false if not allowPicking', () => {
      cesiumTileset.allowPicking = false;

      const object = cesiumTileset.objectClickedHandler(new Cesium3DTileFeature());
      expect(object).to.be.null;
    });
  });

  describe('getZoomToExtent', () => {
    let impl;

    beforeEach(async () => {
      await cesiumTileset.initialize();
      [impl] = cesiumTileset.getImplementationsForMap(cesiumMap);
      await impl.initialize();
    });

    it('should calculate the extent based on a bounding volume with region', () => {
      impl.cesium3DTileset.root.boundingVolume.rectangle = new Rectangle(
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(10),
        CesiumMath.toRadians(10),
      );

      const mercatorExtent = [
        ...Projection.wgs84ToMercator([-10, -10]),
        ...Projection.wgs84ToMercator([10, 10]),
      ];

      const featureExtent = cesiumTileset.getZoomToExtent();
      expect(featureExtent.extent.map(c => Math.round(c)))
        .to.have.ordered.members(mercatorExtent.map(c => Math.round(c)));
    });

    it('should calculate the extent based on a bounding sphere', () => {
      impl.cesium3DTileset = getDummyCesium3DTileset();
      impl.cesium3DTileset.boundingSphere = new BoundingSphere(Cartesian3.fromDegrees(1, 1), 10);

      const mercatorCircle = new Circle(Projection.wgs84ToMercator([1, 1]), 10);
      const featureExtent = cesiumTileset.getZoomToExtent();
      expect(featureExtent.extent.map(c => Math.floor(c)))
        .to.have.ordered.members(mercatorCircle.getExtent().map(c => Math.floor(c)));
    });

    it('should return a configured extent before calculating any other extents', () => {
      impl.cesium3DTileset.root.boundingVolume.rectangle = new Rectangle(
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(10),
        CesiumMath.toRadians(10),
      );

      cesiumTileset.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [0, 0, 1, 1],
      });
      const featureExtent = cesiumTileset.getZoomToExtent();
      expect(featureExtent.extent).to.have.ordered.members([0, 0, 1, 1]);
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const defaultLayer = new CesiumTilesetLayer({});
        const config = defaultLayer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
        defaultLayer.destroy();
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          maximumMemoryUsage: 128,
          screenSpaceErrorMobile: 8,
          screenSpaceError: 8,
          highlightStyle: {
            type: VectorStyleItem.className,
            name: 'highlightStyle',
            fill: {
              color: [255, 0, 0, 1],
            },
          },
          tilesetOptions: {
            test: true,
            maximumMemoryUsage: 64,
          },
          offset: [0, 0, 20],
        };
        configuredLayer = new CesiumTilesetLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure maximumMemoryUsage', () => {
        expect(outputConfig).to.have.property('maximumMemoryUsage', inputConfig.maximumMemoryUsage);
      });

      it('should configure screenSpaceError', () => {
        expect(outputConfig).to.have.property('screenSpaceError', inputConfig.screenSpaceError);
      });

      it('should configure screenSpaceErrorMobile', () => {
        expect(outputConfig).to.have.property('screenSpaceErrorMobile', inputConfig.screenSpaceErrorMobile);
      });

      it('should configure tilesetOptions', () => {
        expect(outputConfig).to.have.property('tilesetOptions')
          .and.to.eql(inputConfig.tilesetOptions);
      });

      it('should configure highlightStyle', () => {
        expect(outputConfig).to.have.property('highlightStyle')
          .and.to.eql(inputConfig.highlightStyle);
      });

      it('should configure offset', () => {
        expect(outputConfig).to.have.property('offset')
          .and.to.eql(inputConfig.offset);
      });
    });
  });
});
