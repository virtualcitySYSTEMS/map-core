import {
  Matrix4,
  BoundingSphere,
  Cartesian3,
  Math as CesiumMath,
  Rectangle,
  CustomShader,
} from '@vcmap-cesium/engine';
import Circle from 'ol/geom/Circle.js';
import CesiumTilesetLayer from '../../../src/layer/cesiumTilesetLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import getDummyCesium3DTileset from './cesium/getDummyCesium3DTileset.js';
import Projection, { wgs84Projection } from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';
import { createTilesetServer, setCesiumMap } from '../helpers/cesiumHelpers.js';
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
    cesiumTileset = new CesiumTilesetLayer({
      url: 'http://test.com/tileset.json',
    });
  });

  afterEach(() => {
    cesiumTileset.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
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

  describe('customShader', () => {
    let customShader;

    before(() => {
      customShader = new CustomShader({});
    });

    it('should return the customShader', () => {
      cesiumTileset.customShader = customShader;
      expect(cesiumTileset.customShader).to.equal(customShader);
    });

    it('should update the customShader of its implementations', () => {
      const [impl] = cesiumTileset.getImplementationsForMap(cesiumMap);
      cesiumTileset.customShader = customShader;
      expect(impl.customShader).to.equal(customShader);
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
      expect(
        featureExtent.extent.map((c) => Math.round(c)),
      ).to.have.ordered.members(mercatorExtent.map((c) => Math.round(c)));
    });

    it('should calculate the extent based on a bounding sphere', () => {
      impl.cesium3DTileset = getDummyCesium3DTileset();
      impl.cesium3DTileset.boundingSphere = new BoundingSphere(
        Cartesian3.fromDegrees(1, 1),
        10,
      );

      const mercatorCircle = new Circle(Projection.wgs84ToMercator([1, 1]), 10);
      const featureExtent = cesiumTileset.getZoomToExtent();
      expect(
        featureExtent.extent.map((c) => Math.floor(c)),
      ).to.have.ordered.members(
        mercatorCircle.getExtent().map((c) => Math.floor(c)),
      );
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
          },
          offset: [0, 0, 20],
        };
        configuredLayer = new CesiumTilesetLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure screenSpaceError', () => {
        expect(outputConfig).to.have.property(
          'screenSpaceError',
          inputConfig.screenSpaceError,
        );
      });

      it('should configure screenSpaceErrorMobile', () => {
        expect(outputConfig).to.have.property(
          'screenSpaceErrorMobile',
          inputConfig.screenSpaceErrorMobile,
        );
      });

      it('should configure tilesetOptions', () => {
        expect(outputConfig)
          .to.have.property('tilesetOptions')
          .and.to.eql(inputConfig.tilesetOptions);
      });

      it('should configure highlightStyle', () => {
        expect(outputConfig)
          .to.have.property('highlightStyle')
          .and.to.eql(inputConfig.highlightStyle);
      });

      it('should configure offset', () => {
        expect(outputConfig)
          .to.have.property('offset')
          .and.to.eql(inputConfig.offset);
      });
    });
  });
});
