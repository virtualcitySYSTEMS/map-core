import sinon from 'sinon';
import { expect } from 'chai';
import { SplitDirection } from '@vcmap-cesium/engine';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import type { OpenStreetMapOptions } from '../../../src/layer/openStreetMapLayer.js';
import OpenStreetMapLayer from '../../../src/layer/openStreetMapLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import type OpenlayersMap from '../../../src/map/openlayersMap.js';

describe('OpenStreetMapLayer', () => {
  let sandbox: sinon.SinonSandbox;
  let app: VcsApp;
  let openStreetMapLayer: OpenStreetMapLayer;
  let map: OpenlayersMap;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    map = await setOpenlayersMap(app);
  });

  beforeEach(() => {
    openStreetMapLayer = new OpenStreetMapLayer({});
  });

  afterEach(() => {
    openStreetMapLayer.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('splitDirection', () => {
    it('should return the split direction', () => {
      openStreetMapLayer.splitDirection = SplitDirection.LEFT;
      expect(openStreetMapLayer.splitDirection).to.equal(SplitDirection.LEFT);
    });

    it('should call the SPLIT_DIRECTION_CHANGED events', () => {
      const spy = getVcsEventSpy(
        openStreetMapLayer.splitDirectionChanged,
        sandbox,
      );
      openStreetMapLayer.splitDirection = SplitDirection.LEFT;
      expect(spy).to.have.been.calledWith(SplitDirection.LEFT);
    });

    it('should not publish the SPLIT_DIRECTION_CHANGED event, if it does not changed', () => {
      openStreetMapLayer.splitDirection = SplitDirection.LEFT;
      const spy = getVcsEventSpy(
        openStreetMapLayer.splitDirectionChanged,
        sandbox,
      );
      openStreetMapLayer.splitDirection = SplitDirection.LEFT;
      expect(spy).to.not.have.been.called;
    });

    it('should call updateSplitDirection on all implementations', () => {
      const [impl] = openStreetMapLayer.getImplementationsForMap(map);
      const updateSplitDirection = sandbox.spy(impl, 'updateSplitDirection');
      openStreetMapLayer.splitDirection = SplitDirection.LEFT;
      expect(updateSplitDirection).to.have.been.calledWithExactly(
        SplitDirection.LEFT,
      );
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = openStreetMapLayer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig: OpenStreetMapOptions;
      let outputConfig: OpenStreetMapOptions;
      let configuredLayer: OpenStreetMapLayer;

      before(() => {
        inputConfig = {
          maxLevel: 15,
          opacity: 0.5,
          minRenderingLevel: 18,
          maxRenderingLevel: 20,
          imageryLayerOptions: { alpha: 2 },
          splitDirection: 'left',
        };
        configuredLayer = new OpenStreetMapLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure maxLevel', () => {
        expect(outputConfig).to.have.property('maxLevel', inputConfig.maxLevel);
      });

      it('should configure opacity', () => {
        expect(outputConfig).to.have.property('opacity', inputConfig.opacity);
      });

      it('should configure splitDirection', () => {
        expect(outputConfig).to.have.property(
          'splitDirection',
          inputConfig.splitDirection,
        );
      });

      it('should configure minRenderingLevel', () => {
        expect(outputConfig).to.have.property(
          'minRenderingLevel',
          inputConfig.minRenderingLevel,
        );
      });

      it('should configure maxRenderingLevel', () => {
        expect(outputConfig).to.have.property(
          'maxRenderingLevel',
          inputConfig.maxRenderingLevel,
        );
      });

      it('should configure imageryLayerOptions', () => {
        expect(outputConfig).to.have.property('imageryLayerOptions');
        expect(outputConfig.imageryLayerOptions).to.deep.equal(
          inputConfig.imageryLayerOptions,
        );
      });
    });
  });

  describe('setting opacity', () => {
    it('should set a new opacity', () => {
      openStreetMapLayer.opacity = 0.5;
      expect(openStreetMapLayer.opacity).to.equal(0.5);
    });

    it('should clip opacity to 0 and 1', () => {
      openStreetMapLayer.opacity = 2;
      expect(openStreetMapLayer.opacity).to.equal(1);
      openStreetMapLayer.opacity = -2;
      expect(openStreetMapLayer.opacity).to.equal(0);
    });

    it('should update all implementations, if the opacity changes', () => {
      const [impl] = openStreetMapLayer.getImplementationsForMap(map);
      const updateOpacity = sandbox.spy(impl, 'updateOpacity');
      openStreetMapLayer.opacity = 0.5;
      openStreetMapLayer.opacity = 0.5;
      expect(updateOpacity).to.have.been.calledOnceWith(0.5);
    });
  });
});
