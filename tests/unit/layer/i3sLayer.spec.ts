import type {
  I3SLayer as CesiumI3SLayer,
  Cesium3DTileset,
} from '@vcmap-cesium/engine';
import {
  Rectangle,
  Math as CesiumMath,
  I3SDataProvider,
  Event as CesiumEvent,
} from '@vcmap-cesium/engine';
import sinon from 'sinon';
import type { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import type Feature from 'ol/Feature.js';
import TestAttributeProvider from '../featureProvider/testAttributeProvider.js';
import I3SLayer from '../../../src/layer/i3sLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import Projection, { wgs84Projection } from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';
import { setCesiumMap } from '../helpers/cesiumHelpers.js';
import type { CesiumMap, I3SCesiumImpl, I3SOptions } from '../../../index.js';
import {
  AbstractFeatureProvider,
  CompositeFeatureProvider,
  VectorStyleItem,
} from '../../../index.js';
import getDummyCesium3DTileset from './cesium/getDummyCesium3DTileset.js';
import I3SAttributeProvider from '../../../src/featureProvider/i3sAttributeProvider.js';

class TestFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TestFeatureProvider';
  }

  // eslint-disable-next-line class-methods-use-this
  getFeaturesByCoordinate(): Promise<Feature[]> {
    return Promise.resolve([]);
  }
}

describe('I3SLayer', () => {
  let sandbox: SinonSandbox;
  let app: VcsApp;
  let i3sLayer: I3SLayer;
  let cesiumMap: CesiumMap;
  let i3sDataProvider: I3SDataProvider;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    const tileset = getDummyCesium3DTileset() as Cesium3DTileset;
    tileset.tileLoad = new CesiumEvent();
    i3sDataProvider = {
      destroy: sandbox.spy(),
      show: false,
      extent: new Rectangle(
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(-10),
        CesiumMath.toRadians(10),
        CesiumMath.toRadians(10),
      ),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      layers: [{ tileset } as CesiumI3SLayer],
    } as unknown as I3SDataProvider;
    sandbox.stub(I3SDataProvider, 'fromUrl').resolves(i3sDataProvider);

    i3sLayer = new I3SLayer({
      url: 'http://test.com/layer',
    });
  });

  afterEach(() => {
    i3sLayer.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('getZoomToExtent', () => {
    let impl: I3SCesiumImpl;

    beforeEach(async () => {
      await i3sLayer.initialize();
      [impl] = i3sLayer.getImplementationsForMap(cesiumMap);
      await impl.initialize();
    });

    it('should calculate the extent based on the data provider extent', () => {
      const mercatorExtent = [
        ...Projection.wgs84ToMercator([-10, -10]),
        ...Projection.wgs84ToMercator([10, 10]),
      ];

      const featureExtent = i3sLayer.getZoomToExtent()!;
      expect(
        featureExtent.extent.map((c) => Math.round(c)),
      ).to.have.ordered.members(mercatorExtent.map((c) => Math.round(c)));
    });

    it('should return a configured extent before calculating any other extents', () => {
      i3sLayer.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [0, 0, 1, 1],
      });
      const featureExtent = i3sLayer.getZoomToExtent()!;
      expect(featureExtent.extent).to.have.ordered.members([0, 0, 1, 1]);
    });
  });

  describe('setMaximumScreenSpaceError', () => {
    let impl: I3SCesiumImpl;

    beforeEach(async () => {
      await i3sLayer.initialize();
      [impl] = i3sLayer.getImplementationsForMap(cesiumMap);
      await impl.initialize();
    });

    it('should set the maximumScreenSpaceError on the tilesets', () => {
      i3sLayer.setMaximumScreenSpaceError(32);
      expect(
        i3sDataProvider.layers[0].tileset?.maximumScreenSpaceError,
      ).to.equal(32);
    });
  });

  describe('creation with attributeProvider and/or featureProvider', () => {
    it('should use the default I3SAttributeProvider if none is provided', () => {
      const layer = new I3SLayer({});
      expect(layer.attributeProvider).to.be.instanceOf(I3SAttributeProvider);
      layer.destroy();
    });

    it('should override the default I3SAttributeProvider when a custom attributeProvider is passed', () => {
      const customAttributeProvider = new TestAttributeProvider(42);
      const layer = new I3SLayer({
        attributeProvider: customAttributeProvider,
      });
      expect(layer.attributeProvider).to.eql(customAttributeProvider);
      expect(layer.attributeProvider).to.not.be.instanceOf(
        I3SAttributeProvider,
      );
      layer.destroy();
    });

    it('should create a composite attributeProvider when hasBatchTable is false and allowPicking is true', () => {
      const testFeatureProvider = new TestFeatureProvider({});
      const layer = new I3SLayer({
        featureProvider: testFeatureProvider,
        hasBatchTable: false,
        allowPicking: true,
      });
      const composite = layer.attributeProvider;
      expect(composite).to.be.instanceOf(CompositeFeatureProvider);

      const config = layer.toJSON();
      expect(config.featureProvider).to.eql(testFeatureProvider.toJSON());
      expect(config.attributeProvider).to.be.undefined;
      layer.destroy();
    });

    it('should use I3SAttributeProvider when hasBatchTable is true (regardless of allowPicking)', () => {
      [undefined, true, false].forEach((allowPicking) => {
        const layer = new I3SLayer({ hasBatchTable: true, allowPicking });
        expect(layer.attributeProvider).to.be.instanceOf(I3SAttributeProvider);
        layer.destroy();
      });
    });

    it('should not use the custom attributeProvider when hasBatchTable is false and allowPicking is false', () => {
      const customAttributeProvider = new TestAttributeProvider(456);
      const layer = new I3SLayer({
        hasBatchTable: false,
        allowPicking: false,
        attributeProvider: customAttributeProvider,
      });
      expect(layer.attributeProvider).to.be.undefined;
      layer.destroy();
    });

    it('should use the custom featureProvider when hasBatchTable is false and allowPicking is false', () => {
      const testFeatureProvider = new TestFeatureProvider({});
      const layer = new I3SLayer({
        hasBatchTable: false,
        allowPicking: false,
        featureProvider: testFeatureProvider,
      });
      expect(layer.featureProvider).to.be.instanceOf(TestFeatureProvider);
      expect(layer.attributeProvider).to.be.undefined;
      layer.destroy();
    });

    it('should use I3SAttributeProvider when hasBatchTable is true and a custom attributeProvider is set', () => {
      const customAttributeProvider = new TestAttributeProvider(99);
      const layer = new I3SLayer({
        hasBatchTable: true,
        attributeProvider: customAttributeProvider,
      });
      expect(layer.attributeProvider).to.eql(customAttributeProvider);
      expect(layer.attributeProvider).to.not.be.instanceOf(
        I3SAttributeProvider,
      );
      layer.destroy();
    });

    it('should use the custom featureProvider when hasBatchTable is true and a featureProvider is set', () => {
      const testFeatureProvider = new TestFeatureProvider({});
      const layer = new I3SLayer({
        hasBatchTable: true,
        featureProvider: testFeatureProvider,
      });
      expect(layer.featureProvider).to.eql(testFeatureProvider);
      expect(layer.attributeProvider).to.be.instanceOf(I3SAttributeProvider);
      layer.destroy();
    });

    it('should use the custom featureProvider when hasBatchTable is false and allowPicking is true and a featureProvider is set', () => {
      const testFeatureProvider = new TestFeatureProvider({});
      const layer = new I3SLayer({
        hasBatchTable: false,
        allowPicking: true,
        featureProvider: testFeatureProvider,
      });
      expect(layer.featureProvider).to.eql(testFeatureProvider);
      expect(layer.attributeProvider).to.be.instanceOf(
        CompositeFeatureProvider,
      );
      layer.destroy();
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const defaultLayer = new I3SLayer({});
        const config = defaultLayer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
        defaultLayer.destroy();
      });
    });

    describe('of a configured layer', () => {
      let inputConfig: I3SOptions;
      let outputConfig: I3SOptions;
      let configuredLayer: I3SLayer;

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
          cesium3dTilesetOptions: {
            maximumScreenSpaceError: 16,
          },
          adjustMaterialAlphaMode: true,
          applySymbology: true,
          calculateNormals: true,
          showFeatures: true,
          lightColor: { x: 1, y: 1, z: 1 },
          outlineColor: 'rgba(255,0,0,1)',
        };
        configuredLayer = new I3SLayer(inputConfig);
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

      it('should configure cesium3dTilesetOptions', () => {
        expect(outputConfig)
          .to.have.property('cesium3dTilesetOptions')
          .and.to.eql(inputConfig.cesium3dTilesetOptions);
      });

      it('should configure highlightStyle', () => {
        expect(outputConfig)
          .to.have.property('highlightStyle')
          .and.to.eql(inputConfig.highlightStyle);
      });

      it('should configure adjustMaterialAlphaMode', () => {
        expect(outputConfig).to.have.property(
          'adjustMaterialAlphaMode',
          inputConfig.adjustMaterialAlphaMode,
        );
      });

      it('should configure applySymbology', () => {
        expect(outputConfig).to.have.property(
          'applySymbology',
          inputConfig.applySymbology,
        );
      });

      it('should configure calculateNormals', () => {
        expect(outputConfig).to.have.property(
          'calculateNormals',
          inputConfig.calculateNormals,
        );
      });

      it('should configure showFeatures', () => {
        expect(outputConfig).to.have.property(
          'showFeatures',
          inputConfig.showFeatures,
        );
      });

      it('should configure lightColor', () => {
        expect(outputConfig)
          .to.have.property('lightColor')
          .and.to.eql(inputConfig.lightColor);
      });

      it('should configure outlineColor', () => {
        expect(outputConfig).to.have.property(
          'outlineColor',
          inputConfig.outlineColor,
        );
      });
    });
  });
});
