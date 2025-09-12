import { validate, v4 as uuidv4 } from 'uuid';
import sinon from 'sinon';
import { expect } from 'chai';
import VcsMap, { type VcsMapOptions } from '../../../src/map/vcsMap.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import Layer from '../../../src/layer/layer.js';
import MapState from '../../../src/map/mapState.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';

describe('VcmMap', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  describe('creating a map', () => {
    let map: VcsMap;

    before(() => {
      map = new VcsMap({});
    });

    after(() => {
      map.destroy();
    });

    it('should create a default layer collection', () => {
      expect(map.layerCollection).to.be.an.instanceOf(LayerCollection);
    });

    describe('and its mapElement', () => {
      it('should be an HTML element', () => {
        expect(map.mapElement).to.be.an.instanceOf(HTMLElement);
      });

      it('should have a random uuid as its id', () => {
        expect(map.mapElement.id).to.be.a('string');
        expect(validate(map.mapElement.id)).to.be.true;
      });

      it('should be hidden', () => {
        expect(map.mapElement.style).to.have.property('display', 'none');
      });

      it('should have mapElement and vcm-map-top classes', () => {
        expect(map.mapElement.classList.contains('mapElement')).to.be.true;
      });
    });
  });

  describe('layer collection handling', () => {
    let layer1: Layer;
    let layer2: Layer;
    let map: VcsMap;
    let layerCollection: LayerCollection;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      layerCollection = new LayerCollection();
      map = new VcsMap({ layerCollection });
    });

    afterEach(() => {
      map.destroy();
      layerCollection.destroy();
      sandbox.restore();
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding of a layer', () => {
      it('should call map activated on the layer, if the map is active', async () => {
        await map.activate();
        const mapActivated = sandbox.spy(layer1, 'mapActivated');
        layerCollection.add(layer1);
        expect(mapActivated).to.have.been.calledOnceWith(map);
      });

      it('should not call map activated, if the map is not active', () => {
        const mapActivated = sandbox.spy(layer2, 'mapActivated');
        layerCollection.add(layer1);
        expect(mapActivated).to.not.have.been.called;
      });
    });

    describe('removing a layer', () => {
      it('should call removedFromMap on the layer', () => {
        const mapActivated = sandbox.spy(layer1, 'removedFromMap');
        layerCollection.add(layer1);
        layerCollection.remove(layer1);
        expect(mapActivated).to.have.been.calledOnceWith(map);
      });
    });

    describe('moving layers within the collection', () => {
      it('should call index changed', () => {
        layerCollection.add(layer1);
        layerCollection.add(layer2);
        const indexChanged = sandbox.spy(map, 'indexChanged');
        layerCollection.lower(layer2);
        expect(indexChanged).to.have.been.calledOnce;
      });
    });

    describe('setting a new layer collection', () => {
      let otherLayerCollection: LayerCollection;

      beforeEach(() => {
        otherLayerCollection = new LayerCollection();
        map.layerCollection = otherLayerCollection;
      });

      afterEach(() => {
        otherLayerCollection.destroy();
      });

      it('should call removedFromMap for all layers currently in the collection', () => {
        const removedFromMap = sandbox.spy(layer1, 'removedFromMap');
        otherLayerCollection.add(layer1);
        const yetAnotherCollection = new LayerCollection();
        map.layerCollection = yetAnotherCollection;
        expect(removedFromMap).to.have.been.calledOnceWith(map);
        yetAnotherCollection.destroy();
      });

      describe('adding of a layer', () => {
        beforeEach(async () => {
          await map.activate();
        });

        it('should call map activated on the layer added to the new collection', () => {
          const mapActivated = sandbox.spy(layer1, 'mapActivated');
          otherLayerCollection.add(layer1);
          expect(mapActivated).to.have.been.calledOnceWith(map);
        });

        it('should not call map activated on the layer added to the previous collection', () => {
          const mapActivated = sandbox.spy(layer2, 'mapActivated');
          layerCollection.add(layer1);
          expect(mapActivated).to.not.have.been.called;
        });
      });

      describe('removing a layer', () => {
        it('should call removedFromMap on layers removed from the new collection', () => {
          const removedFromMap = sandbox.spy(layer1, 'removedFromMap');
          otherLayerCollection.add(layer1);
          otherLayerCollection.remove(layer1);
          expect(removedFromMap).to.have.been.calledOnceWith(map);
        });

        it('should not call removedFromMap on layers removed from the previous collection', () => {
          const removedFromMap = sandbox.spy(layer2, 'removedFromMap');
          layerCollection.add(layer1);
          layerCollection.remove(layer1);
          expect(removedFromMap).to.not.have.been.called;
        });
      });

      describe('moving layers within the collection', () => {
        it('should call index changed on layers within the new collection', () => {
          otherLayerCollection.add(layer1);
          otherLayerCollection.add(layer2);
          const indexChanged = sandbox.spy(map, 'indexChanged');
          otherLayerCollection.lower(layer2);
          expect(indexChanged).to.have.been.calledOnce;
        });

        it('should not call index changed on layers within the previous collection', () => {
          layerCollection.add(layer1);
          layerCollection.add(layer2);
          const indexChanged = sandbox.spy(map, 'indexChanged');
          layerCollection.lower(layer2);
          expect(indexChanged).to.not.have.been.called;
        });
      });
    });
  });

  describe('setting of a target', () => {
    describe('within a constructor', () => {
      it('should set an HTMLElement as the target', () => {
        const target = document.createElement('div');
        const map = new VcsMap({ target });
        expect(map.target).to.equal(target);
        expect(map.mapElement.parentElement).to.equal(target);
        map.destroy();
      });

      it('should set an element based on its ID', () => {
        const target = document.createElement('div');
        const targetId = uuidv4();
        target.id = targetId;
        document.body.appendChild(target);
        const map = new VcsMap({ target: targetId });
        expect(map.target).to.equal(target);
        expect(map.mapElement.parentElement).to.equal(target);
        map.destroy();
      });

      it('should set the target to be null if no target is specified', () => {
        const map = new VcsMap({});
        expect(map.target).to.be.null;
        map.destroy();
      });
    });

    describe('using the API', () => {
      let map: VcsMap;

      beforeEach(() => {
        map = new VcsMap({});
      });

      afterEach(() => {
        map.destroy();
      });

      it('should set an HTMLElement', () => {
        const target = document.createElement('div');
        map.setTarget(target);
        expect(map.target).to.equal(target);
        expect(map.mapElement.parentElement).to.equal(target);
      });

      it('should set a target, based on its ID', () => {
        const target = document.createElement('div');
        const targetId = uuidv4();
        target.id = targetId;
        document.body.appendChild(target);
        map.setTarget(targetId);
        expect(map.target).to.equal(target);
        expect(map.mapElement.parentElement).to.equal(target);
      });

      it('should unset the target', () => {
        const target = document.createElement('div');
        map.setTarget(target);
        map.setTarget(null);
        expect(map.target).to.be.null;
        expect(target.hasChildNodes()).to.be.false;
      });
    });
  });

  describe('activating a map', () => {
    let map: VcsMap;

    beforeEach(() => {
      map = new VcsMap({});
    });

    afterEach(() => {
      map.layerCollection.destroy();
      map.destroy();
    });

    it('should set the map active', async () => {
      await map.activate();
      expect(map.active).to.be.true;
    });

    it('should raise the loading and active state events', async () => {
      const spy = sandbox.spy();
      const listener = map.stateChanged.addEventListener((state) => {
        spy(state);
      });
      await map.activate();
      expect(spy).to.have.been.calledTwice;
      expect(spy.getCall(0).args).to.have.members([MapState.LOADING]);
      expect(spy.getCall(1).args).to.have.members([MapState.ACTIVE]);
      listener();
    });

    it('should initialize the map', async () => {
      const initialize = sandbox.spy(map, 'initialize');
      await map.activate();
      expect(initialize).to.have.been.calledOnce;
    });

    it('should not activate the map, if the map is deactivated in the mean time', async () => {
      const promise = map.activate();
      const spy = getVcsEventSpy(map.stateChanged, sandbox);
      map.deactivate();
      await promise;
      expect(spy).to.not.have.been.calledWith(MapState.ACTIVE);
      expect(map.active).to.be.false;
    });

    it('should remove display none from the map element', async () => {
      await map.activate();
      expect(map.mapElement.style).to.have.property('display', '');
    });

    describe('with layers', () => {
      let layer: Layer;
      let mapActivated: sinon.SinonSpy;

      before(() => {
        layer = new Layer({});
      });

      beforeEach(() => {
        mapActivated = sandbox.spy(layer, 'mapActivated');
        map.layerCollection.add(layer);
      });

      afterEach(() => {
        sandbox.restore();
      });

      after(() => {
        layer.destroy();
      });

      it('should call mapActivated on all its layers', async () => {
        await map.activate();
        expect(mapActivated).to.have.been.calledOnceWith(map);
      });

      it('should call mapActivated on its layers before calling stateChanged', async () => {
        const promise = map.activate();
        const spy = getVcsEventSpy(map.stateChanged, sandbox);
        await promise;
        expect(spy).to.have.been.calledOnce;
        expect(mapActivated).to.have.been.calledBefore(spy);
      });

      it('should not call mapActivated, if the map is deactivated in the mean time', async () => {
        const promise = map.activate();
        map.deactivate();
        await promise;
        expect(mapActivated).to.not.have.been.called;
      });

      it('should not raise state changed, if the map is deactivated while a layer is handling mapActivated', async () => {
        const layer2 = new Layer({});
        layer2.mapActivated = (): Promise<void> => {
          map.deactivate();
          return Promise.resolve();
        };
        map.layerCollection.add(layer2);
        const spy = sandbox.spy();
        const listener = map.stateChanged.addEventListener(spy);
        await map.activate();
        expect(spy).to.not.have.been.calledWith(MapState.ACTIVE);
        expect(map.active).to.be.false;
        listener();
      });
    });
  });

  describe('deactivating a map', () => {
    let map: VcsMap;

    beforeEach(async () => {
      map = new VcsMap({});
      await map.activate();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set active to false', () => {
      map.deactivate();
      expect(map.active).to.be.false;
    });

    it('should raise the state changed event', () => {
      const spy = getVcsEventSpy(map.stateChanged, sandbox);
      map.deactivate();
      expect(spy).to.have.been.calledOnceWith(MapState.INACTIVE);
    });

    it('should set the map elements display to none', () => {
      map.deactivate();
      expect(map.mapElement.style).to.have.property('display', 'none');
    });

    describe('with layers', () => {
      let layer: Layer;
      let mapDeactivated: sinon.SinonSpy;

      before(() => {
        layer = new Layer({});
      });

      beforeEach(() => {
        mapDeactivated = sandbox.spy(layer, 'mapDeactivated');
        map.layerCollection.add(layer);
      });

      afterEach(() => {
        sandbox.restore();
      });

      after(() => {
        layer.destroy();
      });

      it('should call mapDeactivated', () => {
        map.deactivate();
        expect(mapDeactivated).to.have.been.calledOnceWith(map);
      });

      it('should call mapDeactivated before raising the stateChanged event', () => {
        const spy = getVcsEventSpy(map.stateChanged, sandbox);
        map.deactivate();
        expect(spy).to.have.been.calledOnce;
        expect(mapDeactivated).to.have.been.calledBefore(spy);
      });
    });
  });

  describe('setting layer types', () => {
    let map: VcsMap;

    beforeEach(() => {
      map = new VcsMap({});
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the layer types on the map', () => {
      const layerTypes = ['type1', 'type2'];
      map.layerTypes = layerTypes;
      expect(map.layerTypes).to.have.members(layerTypes);
    });

    it('should default to an empty array', () => {
      expect(map.layerTypes).to.be.an('array').that.is.empty;
    });

    it('should call layerTypeChanged when setting layer types', () => {
      const spy = getVcsEventSpy(map.layerTypesChanged, sandbox);
      const layerTypes = ['type1', 'type2'];
      map.layerTypes = layerTypes;
      expect(spy).to.have.been.calledOnceWith(layerTypes);
    });

    it('should not call layerTypeChanged when setting the same layer types', () => {
      const layerTypes = ['type1', 'type2'];
      map.layerTypes = layerTypes;
      const spy = getVcsEventSpy(map.layerTypesChanged, sandbox);
      map.layerTypes = layerTypes;
      expect(spy).to.not.have.been.called;
    });

    it('should not call layerTypeChanged when setting the same layer types, regardless of order', () => {
      map.layerTypes = ['type1', 'type2'];
      const spy = getVcsEventSpy(map.layerTypesChanged, sandbox);
      map.layerTypes = ['type2', 'type1'];
      expect(spy).to.not.have.been.called;
    });
  });

  describe('destroying a map', () => {
    let map: VcsMap;
    let layer: Layer;

    before(() => {
      layer = new Layer({});
    });

    beforeEach(() => {
      map = new VcsMap({});
    });

    after(() => {
      layer.destroy();
    });

    it('should set the map element to a new element', () => {
      const { mapElement } = map;
      map.destroy();
      expect(map.mapElement).to.not.equal(mapElement);
    });

    it('should remove the map from its parent', () => {
      const { mapElement } = map;
      map.destroy();
      expect(document.getElementById('mapContainer')?.contains(mapElement)).to
        .be.false;
    });

    it('should no longer listen to events on the layer collection', () => {
      map.layerCollection.add(layer);
      map.destroyLayerCollection = false;
      const { layerCollection } = map;
      map.destroy();
      const removedFromMap = sandbox.spy(layer, 'removedFromMap');
      layerCollection.remove(layer);
      expect(removedFromMap).to.not.have.been.called;
      layerCollection.destroy();
      sandbox.restore();
    });

    it('should call removedFromMap on its layers', () => {
      map.layerCollection.add(layer);
      const removedFromMap = sandbox.spy(layer, 'removedFromMap');
      map.destroy();
      expect(removedFromMap).to.have.been.calledOnceWith(map);
      sandbox.restore();
    });

    it('should destroy the layerCollection, if destroyLayerCollection is true', () => {
      map.destroyLayerCollection = true;
      const destroy = sandbox.spy(map.layerCollection, 'destroy');
      map.destroy();
      expect(destroy).to.have.been.called;
    });

    it('should not destroy the layerCollection, if destroyLayerCollection is true', () => {
      map.destroyLayerCollection = false;
      const destroy = sandbox.spy(map.layerCollection, 'destroy');
      map.destroy();
      expect(destroy).to.not.have.been.called;
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      let map: VcsMap;

      before(() => {
        map = new VcsMap({});
      });

      after(() => {
        map.destroy();
      });

      it('should return a valid config object', () => {
        const config = map.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured object', () => {
      let map: VcsMap;
      let inputConfig: VcsMapOptions;
      let outputConfig: VcsMapOptions;

      before(() => {
        inputConfig = {
          name: 'name',
          layerTypes: ['type1', 'type2'],
          fallbackToCurrentMap: true,
          fallbackMap: 'mapId',
        };
        map = new VcsMap(inputConfig);
        outputConfig = map.toJSON();
      });

      after(() => {
        map.destroy();
      });

      it('should configure name', () => {
        expect(outputConfig).to.have.property('name', inputConfig.name);
      });

      it('should configure layerTypes', () => {
        expect(outputConfig)
          .to.have.property('layerTypes')
          .that.has.members(inputConfig.layerTypes!);
      });

      it('should configure fallbackToCurrentMap', () => {
        expect(outputConfig).to.have.property(
          'fallbackToCurrentMap',
          inputConfig.fallbackToCurrentMap,
        );
      });

      it('should configure fallbackMap', () => {
        expect(outputConfig).to.have.property(
          'fallbackMap',
          inputConfig.fallbackMap,
        );
      });
    });
  });
});
