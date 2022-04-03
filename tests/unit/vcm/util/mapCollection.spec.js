import { getOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import ViewPoint from '../../../../src/vcs/vcm/util/viewpoint.js';
import MapCollection from '../../../../src/vcs/vcm/util/mapCollection.js';
import Openlayers from '../../../../src/vcs/vcm/maps/openlayers.js';
import { getCesiumEventSpy, getCesiumMap } from '../../helpers/cesiumHelpers.js';
import LayerCollection from '../../../../src/vcs/vcm/util/layerCollection.js';
import Layer from '../../../../src/vcs/vcm/layer/layer.js';
import { SplitScreen } from '../../../../index.js';

describe('vcs.vcm.util.MapCollection', () => {
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
      map = new Openlayers({});
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
        map = new Openlayers({});
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
        map = new Openlayers({});
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
      });

      after(() => {
        map.destroy();
        mapCollection.destroy();
      });

      it('should set the activeMap to null', () => {
        mapCollection.remove(map);
        expect(mapCollection.activeMap).to.be.null;
      });
    });
  });

  describe('setting a layerCollection', () => {
    let mapCollection;
    let map;
    let layerCollection;

    before(() => {
      mapCollection = new MapCollection();
      map = new Openlayers({});
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
      map = new Openlayers({});
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
      map = new Openlayers({});
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
      const spy = getCesiumEventSpy(sandbox, mapCollection.mapActivated);
      await mapCollection.setActiveMap(openlayers.name);
      expect(spy).to.have.been.calledWithExactly(openlayers);
    });

    describe('previous map is another map', () => {
      let vp;

      beforeEach(async () => {
        await mapCollection.setActiveMap(cesiumMap.name);
        vp = new ViewPoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 200],
          distance: 200,
          pitch: -45,
        });
        await cesiumMap.gotoViewPoint(vp);
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
        const newVp = await openlayers.getViewPoint();
        newVp.pitch = -45;
        expect(newVp.groundPosition).to.have.members([0, 0]);
        expect(newVp.distance).to.equal(200);
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
          const spy = getCesiumEventSpy(sandbox, mapCollection.fallbackMapActivated);
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
          const spy = getCesiumEventSpy(sandbox, mapCollection.initializeError);
          await mapCollection.setActiveMap(openlayers.name);
          expect(spy).to.have.been.called;
        });

        it('should raise the fallback map activated event', async () => {
          const spy = getCesiumEventSpy(sandbox, mapCollection.fallbackMapActivated);
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
  });
});
