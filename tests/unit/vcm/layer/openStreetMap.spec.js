import { ImagerySplitDirection } from '@vcmap/cesium';

import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import OpenStreetMap from '../../../../src/vcs/vcm/layer/openStreetMap.js';
import VcsApp from '../../../../src/vcs/vcm/vcsApp.js';

describe('vcs.vcm.layer.OpenStreetMap', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").OpenStreetMap} */
  let openStreetMapLayer;
  let map;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    map = await setOpenlayersMap(app);
  });

  beforeEach(() => {
    openStreetMapLayer = new OpenStreetMap({});
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
      openStreetMapLayer.splitDirection = ImagerySplitDirection.LEFT;
      expect(openStreetMapLayer.splitDirection).to.equal(ImagerySplitDirection.LEFT);
    });

    it('should call the SPLIT_DIRECTION_CHANGED events', () => {
      const spy = getCesiumEventSpy(sandbox, openStreetMapLayer.splitDirectionChanged);
      openStreetMapLayer.splitDirection = ImagerySplitDirection.LEFT;
      expect(spy).to.have.been.calledWith(ImagerySplitDirection.LEFT);
    });

    it('should not publish the SPLIT_DIRECTION_CHANGED event, if it does not changed', () => {
      openStreetMapLayer.splitDirection = ImagerySplitDirection.LEFT;
      const spy = getCesiumEventSpy(sandbox, openStreetMapLayer.splitDirectionChanged);
      openStreetMapLayer.splitDirection = ImagerySplitDirection.LEFT;
      expect(spy).to.not.have.been.called;
    });

    it('should call updateSplitDirection on all implementations', () => {
      const [impl] = openStreetMapLayer.getImplementationsForMap(map);
      const updateSplitDirection = sandbox.spy(impl, 'updateSplitDirection');
      openStreetMapLayer.splitDirection = ImagerySplitDirection.LEFT;
      expect(updateSplitDirection).to.have.been.calledWithExactly(ImagerySplitDirection.LEFT);
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
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          maxLevel: 15,
          opacity: 0.5,
          splitDirection: 'left',
        };
        configuredLayer = new OpenStreetMap(inputConfig);
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
        expect(outputConfig).to.have.property('splitDirection', inputConfig.splitDirection);
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

    it('should update all implementations, if the opacity changes', async () => {
      const [impl] = openStreetMapLayer.getImplementationsForMap(map);
      const updateOpacity = sandbox.spy(impl, 'updateOpacity');
      openStreetMapLayer.opacity = 0.5;
      openStreetMapLayer.opacity = 0.5;
      expect(updateOpacity).to.have.been.calledOnceWith(0.5);
    });
  });
});
