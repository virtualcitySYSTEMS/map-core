import { JulianDate } from '@vcmap/cesium';
import { getOpenlayersMap } from '../helpers/openlayersHelpers.js';
import Viewpoint from '../../../src/util/viewpoint.js';
import MapCollection from '../../../src/util/mapCollection.js';
import OpenlayersMap from '../../../src/map/openlayersMap.js';
import { getVcsEventSpy, getCesiumMap } from '../helpers/cesiumHelpers.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import Layer from '../../../src/layer/layer.js';
import VcsMap from '../../../src/map/vcsMap.js';
import SplitScreen from '../../../src/util/splitScreen.js';
import { makeOverrideCollection } from '../../../index.js';

describe('MapCollection', () => {
  let target;
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
    target = document.createElement('div');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('adding a map', () => {
    let mapCollection;
    let map;

    before(() => {
      mapCollection = new MapCollection();
      mapCollection.setTarget(target);
      map = new OpenlayersMap({});
      mapCollection.add(map);
    });

    after(() => {
      map.destroy();
      mapCollection.destroy();
    });

    it('should add a new map', () => {
      expect(mapCollection.has(map)).to.be.true;
    });

    it('should set the target on the map', () => {
      expect(map.target).to.equal(target);
    });

    it('should set the layerCollection to the map collections layerCollection', () => {
      expect(map.layerCollection).to.equal(mapCollection.layerCollection);
    });

    it('should set the splitScreen', () => {
      expect(map.splitScreen).to.equal(mapCollection.splitScreen);
    });
  });

  describe('removing a map', () => {
    describe('which was part of the collection', () => {
      let mapCollection;
      let map;

      before(() => {
        mapCollection = new MapCollection();
        mapCollection.setTarget(target);
        map = new OpenlayersMap({});
        mapCollection.add(map);
        mapCollection.remove(map);
      });

      after(() => {
        map.destroy();
        mapCollection.destroy();
      });

      it('should remove a new map', () => {
        expect(mapCollection.has(map)).to.be.false;
      });

      it('should set the target on the map to null', () => {
        expect(map.target).to.be.null;
      });

      it('should set an empty layerCollection to the map', () => {
        expect(map.layerCollection).to.not.equal(mapCollection.layerCollection);
        expect(map.layerCollection).to.be.an.instanceOf(LayerCollection);
      });

      it('should set the splitScreen', () => {
        expect(map.splitScreen).to.be.null;
      });
    });

    describe('which was not part of the collection', () => {
      let mapCollection;
      let otherMapCollection;
      let map;

      before(() => {
        mapCollection = new MapCollection();
        otherMapCollection = new MapCollection();
        mapCollection.setTarget(target);
        map = new OpenlayersMap({});
        mapCollection.add(map);
        otherMapCollection.remove(map);
      });

      after(() => {
        map.destroy();
        mapCollection.destroy();
      });

      it('should maintain the collection', () => {
        expect(mapCollection.has(map)).to.be.true;
        expect(otherMapCollection.has(map)).to.be.false;
      });

      it('should set the target on the map', () => {
        expect(map.target).to.equal(target);
      });

      it('should set the layerCollection to the map collections layerCollection', () => {
        expect(map.layerCollection).to.equal(mapCollection.layerCollection);
      });

      it('should set the splitScreen', () => {
        expect(map.splitScreen).to.equal(mapCollection.splitScreen);
      });
    });

    describe('which was the active map', () => {
      let mapCollection;
      let map;
      before(async () => {
        mapCollection = new MapCollection();
        map = await getOpenlayersMap();
        mapCollection.add(map);
        mapCollection.setTarget(target);
        await mapCollection.setActiveMap(map.name);
        mapCollection.remove(map);
      });

      after(() => {
        map.destroy();
        mapCollection.destroy();
      });

      it('should set the activeMap to null', () => {
        expect(mapCollection.activeMap).to.be.null;
      });

      it('should no longer listen to the postRender event on said map', () => {
        const spy = getVcsEventSpy(mapCollection.postRender, sandbox);
        map.postRender.raiseEvent({ map });
        expect(spy).to.not.have.been.called;
      });
    });
  });

  describe('setting a layerCollection', () => {
    let mapCollection;
    let map;
    let layerCollection;

    before(() => {
      mapCollection = new MapCollection();
      map = new OpenlayersMap({});
      mapCollection.add(map);
      layerCollection = LayerCollection.from([new Layer({
        name: 'layer1',
      })]);
      mapCollection.layerCollection = layerCollection;
    });

    after(() => {
      map.destroy();
      mapCollection.destroy();
    });

    it('should set the layerCollection', () => {
      expect(mapCollection.layerCollection).to.equal(layerCollection);
    });

    it('should set the layerCollection on the map', () => {
      expect(map.layerCollection).to.equal(layerCollection);
    });
  });

  describe('setting a target', () => {
    let mapCollection;
    let map;

    before(() => {
      mapCollection = new MapCollection();
      map = new OpenlayersMap({});
      mapCollection.add(map);
      mapCollection.setTarget(target);
    });

    after(() => {
      map.destroy();
      mapCollection.destroy();
    });

    it('should set the target', () => {
      expect(mapCollection.target).to.equal(target);
    });

    it('should set the target on the map', () => {
      expect(map.target).to.equal(target);
    });
  });

  describe('setting a splitScreen', () => {
    let mapCollection;
    let map;
    let splitScreen;

    before(() => {
      mapCollection = new MapCollection();
      map = new OpenlayersMap({});
      mapCollection.add(map);
      splitScreen = new SplitScreen(mapCollection.clippingObjectManager);
      splitScreen.position = 1;
      mapCollection.splitScreen = splitScreen;
    });

    after(() => {
      map.destroy();
      mapCollection.destroy();
    });

    it('should set the splitScreen', () => {
      expect(mapCollection.splitScreen).to.equal(splitScreen);
    });

    it('should set the splitScreen on the map', () => {
      expect(map.splitScreen).to.equal(splitScreen);
    });
  });

  describe('setting the active map', () => {
    /** @type {import("@vcmap/core").MapCollection} */
    let mapCollection;
    let openlayers;
    let cesiumMap;

    beforeEach(async () => {
      openlayers = await getOpenlayersMap();
      cesiumMap = await getCesiumMap();
      mapCollection = MapCollection.from([openlayers, cesiumMap]);
      mapCollection.setTarget(target);
    });

    afterEach(() => {
      openlayers.destroy();
      cesiumMap.destroy();
      mapCollection.destroy();
    });

    it('should set the map as the active map', async () => {
      await mapCollection.setActiveMap(openlayers.name);
      expect(mapCollection.activeMap).to.equal(openlayers);
    });

    it('should activate the map', async () => {
      await mapCollection.setActiveMap(openlayers.name);
      expect(openlayers.active).to.be.true;
    });

    it('should publish the map activated event', async () => {
      const spy = getVcsEventSpy(mapCollection.mapActivated, sandbox);
      await mapCollection.setActiveMap(openlayers.name);
      expect(spy).to.have.been.calledWithExactly(openlayers);
    });

    it('should raise the post render event from said map', async () => {
      await mapCollection.setActiveMap(openlayers.name);
      let event = null;
      mapCollection.postRender.addEventListener((e) => {
        event = e;
      });
      openlayers.requestRender();
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      expect(event).to.not.be.null;
      expect(event).to.have.property('map', openlayers);
    });

    describe('previous map is another map', () => {
      let vp;

      beforeEach(async () => {
        await mapCollection.setActiveMap(cesiumMap.name);
        vp = new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 200],
          distance: 200,
          pitch: -45,
        });
        await cesiumMap.gotoViewpoint(vp);
      });

      it('should check, if the current viewpoint can be shown', async () => {
        const canShowViewpoint = sandbox.spy(openlayers, 'canShowViewpoint');
        await mapCollection.setActiveMap(openlayers.name);
        expect(canShowViewpoint).to.have.been.called;
      });

      it('should deactivate the previous map', async () => {
        await mapCollection.setActiveMap(openlayers.name);
        expect(cesiumMap.active).to.be.false;
      });

      it('should set the previous maps viewpoint on the new map', async () => {
        await mapCollection.setActiveMap(openlayers.name);
        const newVp = await openlayers.getViewpoint();
        newVp.pitch = -45;
        expect(newVp.groundPosition).to.have.members([0, 0]);
        expect(newVp.distance).to.equal(200);
      });

      it('should no longer listen to post render events from the previous map', async () => {
        await mapCollection.setActiveMap(openlayers.name);
        const spy = getVcsEventSpy(mapCollection.postRender, sandbox);
        cesiumMap.postRender.raiseEvent({
          map: cesiumMap,
          originalEven: { scene: cesiumMap.getScene(), time: JulianDate.now() },
        });
        expect(spy).to.not.have.been.called;
      });

      describe('cant show viewpoint', () => {
        let fallbackMap;

        beforeEach(async () => {
          fallbackMap = await getOpenlayersMap({ name: 'test' });
          mapCollection.add(fallbackMap);
          openlayers.fallbackMap = 'test';
          sandbox.stub(openlayers, 'canShowViewpoint').resolves(false);
        });

        it('should publish the MAP_FALLBACK_ACTIVATED event', async () => {
          const spy = getVcsEventSpy(mapCollection.fallbackMapActivated, sandbox);
          await mapCollection.setActiveMap(openlayers.name);
          expect(spy).to.have.been.called;
        });

        it('should call _activateMapHandler with the fallback map', async () => {
          await mapCollection.setActiveMap(openlayers.name);
          expect(mapCollection.activeMap).to.equal(fallbackMap);
        });

        it('should activate the map, if the map has no fallbackMap defined', async () => {
          openlayers.fallbackMap = null;
          await mapCollection.setActiveMap(openlayers.name);
          expect(mapCollection.activeMap).to.equal(openlayers);
        });
      });

      describe('map cannot be initialized', () => {
        let fallbackMap;

        beforeEach(async () => {
          fallbackMap = await getOpenlayersMap({ name: 'test' });
          mapCollection.add(fallbackMap);
          openlayers.fallbackMap = 'test';
          sandbox.stub(openlayers, 'initialize').rejects();
        });

        it('should raise the initialize error event', async () => {
          const spy = getVcsEventSpy(mapCollection.initializeError, sandbox);
          await mapCollection.setActiveMap(openlayers.name);
          expect(spy).to.have.been.called;
        });

        it('should raise the fallback map activated event', async () => {
          const spy = getVcsEventSpy(mapCollection.fallbackMapActivated, sandbox);
          await mapCollection.setActiveMap(openlayers.name);
          expect(spy).to.have.been.called;
        });

        it('should set the fallback map active', async () => {
          await mapCollection.setActiveMap(openlayers.name);
          expect(mapCollection.activeMap).to.equal(fallbackMap);
        });

        it('should remove the map', async () => {
          await mapCollection.setActiveMap(openlayers.name);
          expect(mapCollection.has(openlayers)).to.be.false;
        });
      });
    });

    describe('previous active map was removed', () => {
      let vp;

      beforeEach(async () => {
        await mapCollection.setActiveMap(cesiumMap.name);
        vp = new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 200],
          distance: 200,
          pitch: -45,
        });
        await cesiumMap.gotoViewpoint(vp);
        mapCollection.remove(cesiumMap);
      });

      it('should use a cachedViewpoint from the last activeMap', async () => {
        await mapCollection.setActiveMap(openlayers.name);
        const newVp = await openlayers.getViewpoint();
        newVp.pitch = -45;
        expect(newVp.groundPosition).to.have.members([0, 0]);
        expect(newVp.distance).to.equal(200);
      });
    });
  });

  describe('overrideMapCollection', () => {
    /** @type {OverrideMapCollection} */
    let mapCollection;

    beforeEach(() => {
      mapCollection = new MapCollection();
      makeOverrideCollection(mapCollection, () => { return 'uuid'; }, null, null, VcsMap);
    });

    afterEach(() => {
      mapCollection.destroy();
    });

    describe('on override', () => {
      it('the originalMap should not be activeMap after override', async () => {
        /** @type {VcsMap} */
        const originalMap = new VcsMap({
          name: 'map',
          exclusiveGroups: ['test'],
        });
        /** @type {VcsMap} */
        const overrideMap = new VcsMap({
          name: 'map',
          exclusiveGroups: ['test'],
        });
        mapCollection.add(originalMap);
        await mapCollection.setActiveMap('map');
        mapCollection.override(overrideMap);
        expect(mapCollection.activeMap).to.not.be.equal(originalMap);
        originalMap.destroy();
        overrideMap.destroy();
      });

      it('should synchronize the viewpoint on overriding and setting again an activeMap', async () => {
        const olMap = await getOpenlayersMap({ name: 'map' });
        const olMap2 = await getOpenlayersMap({ name: 'map' });
        mapCollection.add(olMap);
        await mapCollection.setActiveMap('map');
        const vp = new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 200],
          distance: 200,
          pitch: -45,
        });
        await olMap.gotoViewpoint(vp);
        mapCollection.override(olMap2);
        await mapCollection.setActiveMap('map');
        const newVp = await olMap2.getViewpoint();
        expect(newVp.groundPosition).to.have.members([0, 0]);
        expect(newVp.distance).to.equal(200);
      });
    });
  });
});
