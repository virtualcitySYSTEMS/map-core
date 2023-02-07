import { SplitDirection } from '@vcmap-cesium/engine';
import ExclusiveManager from '../../src/util/exclusiveManager.js';
import OpenStreetMapLayer from '../../src/layer/openStreetMapLayer.js';
import LayerState from '../../src/layer/layerState.js';

describe('ExclusiveManager', () => {
  let sandbox;
  /** @type {import("@vcmap/core").ExclusiveManager} */
  let EM;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    EM = new ExclusiveManager();
  });

  afterEach(() => {
    sandbox.restore();
    EM.destroy();
  });

  describe('registerLayer', () => {
    let layerToRegister;

    beforeEach(() => {
      layerToRegister = new OpenStreetMapLayer({});
      layerToRegister.exclusiveGroups = ['test'];
    });

    afterEach(() => {
      layerToRegister.destroy();
    });

    it('should call handleLayerActivated, if the layer active', () => {
      const handleLayerActivated = sandbox.spy(EM, 'handleLayerActivated');
      layerToRegister._state = LayerState.ACTIVE;
      EM.registerLayer(layerToRegister);
      expect(handleLayerActivated).to.have.been.calledWithExactly(layerToRegister);
    });

    describe('with a single group', () => {
      it('should create the layer group, if it does not exist', () => {
        EM.registerLayer(layerToRegister);
        expect(EM.layers.has('test')).to.be.true;
        expect(EM.layers.get('test')).to.be.a('set');
      });

      it('should add the layer to the group', () => {
        EM.registerLayer(layerToRegister);
        expect(EM.layers.get('test').has(layerToRegister)).to.be.true;
      });
    });

    describe('with multiple groups', () => {
      beforeEach(() => {
        layerToRegister.exclusiveGroups = ['test1', 'test2'];
      });

      it('should create the layer group for each group, if it does not exist', () => {
        EM.registerLayer(layerToRegister);
        expect(EM.layers.get('test1')).to.be.a('set');
        expect(EM.layers.get('test2')).to.be.a('set');
      });

      it('should add the layer to the group', () => {
        EM.registerLayer(layerToRegister);
        expect(EM.layers.get('test1').has(layerToRegister)).to.be.true;
        expect(EM.layers.get('test2').has(layerToRegister)).to.be.true;
      });
    });
  });

  describe('unregisterLayer', () => {
    it('should delete a layer from a group', () => {
      const layer = new OpenStreetMapLayer({});
      layer.exclusiveGroups = ['test1', 'test2'];
      EM.registerLayer(layer);
      EM.unregisterLayer(layer);
      expect(EM.layers.get('test1')).to.be.a('set');
      expect(EM.layers.get('test1').has(layer)).to.be.false;
      expect(EM.layers.get('test2')).to.be.a('set');
      expect(EM.layers.get('test2').has(layer)).to.be.false;
      layer.destroy();
    });
  });

  describe('handleSplitDirectionChanged', () => {
    it('should call handleLayerActivated, if the layer is active', () => {
      const handleLayerActivated = sandbox.spy(EM, 'handleLayerActivated');
      const layer = new OpenStreetMapLayer({});
      EM.handleSplitDirectionChanged(layer);
      layer._state = LayerState.ACTIVE;
      EM.handleSplitDirectionChanged(layer);
      expect(handleLayerActivated).to.have.been.calledOnce;
      layer.destroy();
    });
  });

  describe('handleLayerActivated', () => {
    let registeredLayer1;
    let registeredLayer2;
    let deactivate;

    beforeEach(() => {
      registeredLayer1 = new OpenStreetMapLayer({});
      registeredLayer1.exclusiveGroups = ['test'];
      registeredLayer1._state = LayerState.ACTIVE;
      deactivate = sandbox.spy(registeredLayer1, 'deactivate');
      EM.registerLayer(registeredLayer1);
      registeredLayer2 = new OpenStreetMapLayer({});
      registeredLayer2.exclusiveGroups = ['test'];
      EM.registerLayer(registeredLayer2);
    });

    afterEach(() => {
      registeredLayer1.destroy();
      registeredLayer2.destroy();
    });

    it('should deactivate an already active layer in the group', () => {
      EM.handleLayerActivated(registeredLayer2);
      expect(deactivate).to.have.been.called;
    });

    it('should not deactivate an already active layer in the group, if they have differing split directions', () => {
      registeredLayer1._splitDirection = SplitDirection.LEFT;
      registeredLayer2._splitDirection = SplitDirection.RIGHT;
      EM.handleLayerActivated(registeredLayer2);
      expect(deactivate).to.not.have.been.called;
    });
  });

  describe('getActiveLayersForGroup', () => {
    let registeredLayer1;
    let registeredLayer2;

    beforeEach(() => {
      registeredLayer1 = new OpenStreetMapLayer({});
      registeredLayer1.exclusiveGroups = ['test'];
      registeredLayer1._state = LayerState.ACTIVE;
      EM.registerLayer(registeredLayer1);
      registeredLayer2 = new OpenStreetMapLayer({});
      registeredLayer2.exclusiveGroups = ['test'];
      EM.registerLayer(registeredLayer2);
    });

    afterEach(() => {
      registeredLayer1.destroy();
      registeredLayer2.destroy();
    });

    it('should return the active layer for the group', () => {
      const activeLayers = EM.getActiveLayersForGroup('test');
      expect(activeLayers).to.have.length(1);
      expect(activeLayers).to.have.members([registeredLayer1]);
    });

    it('should return 2 active layers, if they are split and active', () => {
      registeredLayer1._splitDirection = SplitDirection.LEFT;
      registeredLayer2._splitDirection = SplitDirection.RIGHT;
      registeredLayer2._state = LayerState.ACTIVE;

      const activeLayers = EM.getActiveLayersForGroup('test');
      expect(activeLayers).to.have.length(2);
      expect(activeLayers).to.have.members([registeredLayer1, registeredLayer2]);
    });
  });

  describe('destroy', () => {
    it('should clear the layers map', () => {
      EM.layers.set('test', new Set());
      EM.destroy();
      expect(EM.layers).to.be.empty;
    });
  });
});
