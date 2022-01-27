import { validate, v4 as uuidv4 } from 'uuid';
import VcsMap from '../../../../src/vcs/vcm/maps/map.js';
import LayerCollection from '../../../../src/vcs/vcm/util/layerCollection.js';
import Layer from '../../../../src/vcs/vcm/layer/layer.js';
import MapState from '../../../../src/vcs/vcm/maps/mapState.js';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';
import { getFramework } from '../../helpers/framework.js';

describe('vcs.vcm.maps.VcmMap', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  describe('creating a map', () => {
    /** @type {import("@vcmap/core").VcsMap} */
    let map;

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
        expect([...map.mapElement.classList.values()]).to.include.members(['mapElement']);
      });
    });
  });

  describe('layer collection handling', () => {
    let layer1;
    let layer2;
    let map;
    let layerCollection;

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
      let otherLayerCollection;

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
      let map;
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
    /** @type {import("@vcmap/core").VcsMap} */
    let map;

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
      const spy = getCesiumEventSpy(sandbox, map.stateChanged);
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
      let layer;
      let mapActivated;

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
        const spy = getCesiumEventSpy(sandbox, map.stateChanged);
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
        layer2.mapActivated = async () => { map.deactivate(); };
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
    /** @type {import("@vcmap/core").VcsMap} */
    let map;

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
      const spy = getCesiumEventSpy(sandbox, map.stateChanged);
      map.deactivate();
      expect(spy).to.have.been.calledOnceWith(MapState.INACTIVE);
    });

    it('should set the map elements display to none', () => {
      map.deactivate();
      expect(map.mapElement.style).to.have.property('display', 'none');
    });

    describe('with layers', () => {
      let layer;
      let mapDeactivated;

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
        const spy = getCesiumEventSpy(sandbox, map.stateChanged);
        map.deactivate();
        expect(spy).to.have.been.calledOnce;
        expect(mapDeactivated).to.have.been.calledBefore(spy);
      });
    });
  });

  describe('destroying a map', () => {
    /** @type {import("@vcmap/core").VcsMap} */
    let map;
    let layer;

    before(() => {
      layer = new Layer({});
    });

    beforeEach(() => {
      map = new VcsMap({});
    });

    after(() => {
      layer.destroy();
    });

    it('should set the map element null', () => {
      map.destroy();
      expect(map.mapElement).to.be.null;
    });

    it('should remove the map from its parent', () => {
      const { mapElement } = map;
      map.destroy();
      expect(getFramework().mapcontainer.contains(mapElement)).to.be.false;
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
});
