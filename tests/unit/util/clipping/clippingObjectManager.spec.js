import ClippingObject from '../../../../src/util/clipping/clippingObject.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import { getOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import MapCollection from '../../../../src/util/mapCollection.js';

describe('util.clipping.ClippingObjectManager', () => {
  let sandbox;
  let vector;
  let mapCollection;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mapCollection = new MapCollection();
    mapCollection.setTarget('mapContainer');
    vector = new VectorLayer({});
    mapCollection.layerCollection.add(vector);
  });

  afterEach(() => {
    sandbox.restore();
    mapCollection.destroy();
  });

  describe('suspendUpdate', () => {
    it('should trigger an update if dirty', () => {
      const update = sandbox.spy(mapCollection.clippingObjectManager, '_update');
      mapCollection.clippingObjectManager._dirty = true;
      mapCollection.clippingObjectManager.suspendUpdate = false;
      expect(update).to.have.been.called;
    });

    it('should clear dirty', () => {
      mapCollection.clippingObjectManager._dirty = true;
      mapCollection.clippingObjectManager.suspendUpdate = false;
      expect(mapCollection.clippingObjectManager._dirty).to.be.false;
    });
  });

  describe('initialize', () => {
    let defaultObject;
    let exclusiveObject;

    beforeEach(() => {
      defaultObject = new ClippingObject();
      exclusiveObject = new ClippingObject();
      mapCollection.clippingObjectManager._defaultClippingObjects.add(defaultObject);
      mapCollection.clippingObjectManager._exclusiveClippingObjects = [exclusiveObject];
      vector.deactivate();
    });

    describe('layer changed', () => {
      it('should call handleLayerChanged on the default objects', () => {
        const spy = sandbox.spy(defaultObject, 'handleLayerChanged');
        vector.activate();
        expect(spy).to.have.been.called;
      });

      it('should call handleLayerChanged on the exclusive objects', () => {
        const spy = sandbox.spy(exclusiveObject, 'handleLayerChanged');
        vector.activate();
        expect(spy).to.have.been.called;
      });

      it('should suspend updated before calling handle layer changed', () => {
        const suspendUpdate = sandbox.spy(mapCollection.clippingObjectManager, 'suspendUpdate', ['set']);
        const handleLayerChanged = sandbox.spy(defaultObject, 'handleLayerChanged');
        vector.activate();
        expect(suspendUpdate.set).to.have.been.calledBefore(handleLayerChanged);
      });

      it('should call resume update after calling handle layer changed', () => {
        const suspendUpdate = sandbox.spy(mapCollection.clippingObjectManager, 'suspendUpdate', ['set']);
        const handleLayerChanged = sandbox.spy(exclusiveObject, 'handleLayerChanged');
        vector.activate();
        expect(suspendUpdate.set).to.have.been.calledAfter(handleLayerChanged);
      });
    });

    describe('map activated', () => {
      let map;

      before(async () => {
        map = await getOpenlayersMap();
      });

      after(() => {
        map.destroy();
      });

      it('should call handleMapChanged on the default objects', () => {
        const spy = sandbox.spy(defaultObject, 'handleMapChanged');
        mapCollection.clippingObjectManager.mapActivated(map);
        expect(spy).to.have.been.called;
      });

      it('should call handleMapChanged on the exclusive objects', () => {
        const spy = sandbox.spy(exclusiveObject, 'handleMapChanged');
        mapCollection.clippingObjectManager.mapActivated(map);
        expect(spy).to.have.been.called;
      });

      it('should suspend updated before calling handle map changed', () => {
        const suspendUpdate = sandbox.spy(mapCollection.clippingObjectManager, 'suspendUpdate', ['set']);
        const handleMapChanged = sandbox.spy(defaultObject, 'handleMapChanged');
        mapCollection.clippingObjectManager.mapActivated(map);
        expect(suspendUpdate.set).to.have.been.calledBefore(handleMapChanged);
      });

      it('should call resume update after calling handle map changed', () => {
        const suspendUpdate = sandbox.spy(mapCollection.clippingObjectManager, 'suspendUpdate', ['set']);
        const handleMapChanged = sandbox.spy(exclusiveObject, 'handleMapChanged');
        mapCollection.clippingObjectManager.mapActivated(map);
        expect(suspendUpdate.set).to.have.been.calledAfter(handleMapChanged);
      });
    });
  });

  describe('addClippingObject', () => {
    let clippingObject;
    let cesiumMap;

    beforeEach(() => {
      cesiumMap = getCesiumMap();
      mapCollection.clippingObjectManager._activeMap = cesiumMap;
      clippingObject = new ClippingObject();
    });

    afterEach(() => {
      mapCollection.clippingObjectManager.removeClippingObject(clippingObject);
      cesiumMap.destroy();
      mapCollection.clippingObjectManager._activeMap = null;
    });

    it('should add a clipping object to the _defaultClippingObjects', () => {
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(mapCollection.clippingObjectManager._defaultClippingObjects.has(clippingObject)).to.be.true;
    });

    it('should call handleMap change, if the active map is the cesium map', () => {
      const handleMapChanged = sandbox.spy(clippingObject, 'handleMapChanged');
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(handleMapChanged).to.have.been.calledWith(cesiumMap);
    });


    it('should call handleLayerChanged for each layer, if the map is the cesium map', () => {
      const handleLayerChanged = sandbox.spy(clippingObject, 'handleLayerChanged');
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(handleLayerChanged).to.have.been.calledWith(vector);
    });

    it('should add an entry to the listeners map', () => {
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(mapCollection.clippingObjectManager._listenersMap.has(clippingObject)).to.be.true;
      expect(mapCollection.clippingObjectManager._listenersMap.get(clippingObject))
        .to.be.an('array').and.have.length(2);
    });

    it('should call update', () => {
      const update = sandbox.spy(mapCollection.clippingObjectManager, '_update');
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(update).to.have.been.called;
    });

    it('should add a listener to targetsUpdated, calling update', () => {
      sandbox.stub(mapCollection.clippingObjectManager._update, 'bind')
        .returns(() => mapCollection.clippingObjectManager._update());
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      const update = sandbox.spy(mapCollection.clippingObjectManager, '_update');
      clippingObject.targetsUpdated.raiseEvent();
      expect(update).to.have.been.called;
    });

    it('should add a listener to clippingPlaneUpdate, calling clippingPlaneUpdated', () => {
      sandbox.stub(mapCollection.clippingObjectManager._clippingPlaneUpdated, 'bind')
        .returns(() => mapCollection.clippingObjectManager._clippingPlaneUpdated());
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      const clippingPlaneUpdated = sandbox.spy(mapCollection.clippingObjectManager, '_clippingPlaneUpdated');
      clippingObject.clippingPlaneUpdated.raiseEvent();
      expect(clippingPlaneUpdated).to.have.been.called;
    });

    it('should throw, if the clipping object is already part of the default clipping objects', () => {
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(
        mapCollection.clippingObjectManager.addClippingObject.bind(mapCollection.clippingObjectManager, clippingObject),
      ).to.throw('ClippingObject already managed, remove it first');
    });

    it('should throw, if the clipping object is part of the exclusive clipping objects', () => {
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], () => {});
      expect(
        mapCollection.clippingObjectManager.addClippingObject.bind(mapCollection.clippingObjectManager, clippingObject),
      ).to.throw('ClippingObject already managed, remove it first');
    });
  });

  describe('removeClippingObject', () => {
    let clippingObject;

    beforeEach(() => {
      clippingObject = new ClippingObject();
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
    });

    it('should remove the clipping object from the default clipping objects', () => {
      mapCollection.clippingObjectManager.removeClippingObject(clippingObject);
      expect(mapCollection.clippingObjectManager._defaultClippingObjects.size).to.be.equal(0);
    });

    it('should remove event listeners', () => {
      mapCollection.clippingObjectManager.removeClippingObject(clippingObject);
      expect(clippingObject.targetsUpdated.numberOfListeners).to.equal(0);
      expect(clippingObject.clippingPlaneUpdated.numberOfListeners).to.equal(0);
    });

    it('should remove the object from the listeners map', () => {
      mapCollection.clippingObjectManager.removeClippingObject(clippingObject);
      expect(mapCollection.clippingObjectManager._listenersMap.get(clippingObject)).to.be.undefined;
    });
  });

  describe('hasClippingObject', () => {
    let clippingObject;

    beforeEach(() => {
      clippingObject = new ClippingObject();
    });

    afterEach(() => {
      mapCollection.clippingObjectManager.removeClippingObject(clippingObject);
      mapCollection.clippingObjectManager.clearExclusiveClippingObjects();
    });

    it('should return true, if a clipping object is part of the default clipping objects', () => {
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(mapCollection.clippingObjectManager.hasClippingObject(clippingObject)).to.be.true;
    });

    it('should return true, if a clipping object is part of the exclusive clipping objects', () => {
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], () => {});
      expect(mapCollection.clippingObjectManager.hasClippingObject(clippingObject)).to.be.true;
    });
  });

  describe('setExclusiveClippingObjects', () => {
    let clippingObject;
    let cb;
    let cesiumMap;

    beforeEach(() => {
      cesiumMap = getCesiumMap();
      mapCollection.clippingObjectManager._activeMap = cesiumMap;
      clippingObject = new ClippingObject();
      cb = sandbox.spy();
    });

    afterEach(() => {
      mapCollection.clippingObjectManager.clearExclusiveClippingObjects();
      cesiumMap.destroy();
      mapCollection.clippingObjectManager._activeMap = null;
    });

    it('should set the exclusive clipping objects array', () => {
      const exclusiveClippingObjects = [clippingObject];
      mapCollection.clippingObjectManager.setExclusiveClippingObjects(exclusiveClippingObjects, cb);
      expect(mapCollection.clippingObjectManager._exclusiveClippingObjects).to.equal(exclusiveClippingObjects);
    });

    it('should clear previously added exclusive clipping planes', () => {
      const clearExclusiveClippingObjects = sandbox.spy(mapCollection.clippingObjectManager, '_clearExclusiveClippingObjects');
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(clearExclusiveClippingObjects).to.have.been.called;
    });

    it('should call handleMap change, if the active map is the cesium map', () => {
      const handleMapChanged = sandbox.spy(clippingObject, 'handleMapChanged');
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(handleMapChanged).to.have.been.calledWith(cesiumMap);
    });

    it('should call handleLayerChanged for each layer, if the map is the cesium map', () => {
      const handleLayerChanged = sandbox.spy(clippingObject, 'handleLayerChanged');
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(handleLayerChanged).to.have.been.calledWith(vector);
    });

    it('should add an entry to the listeners map', () => {
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(mapCollection.clippingObjectManager._listenersMap.has(clippingObject)).to.be.true;
      expect(mapCollection.clippingObjectManager._listenersMap.get(clippingObject))
        .to.be.an('array').and.have.length(2);
    });

    it('should call update', () => {
      const update = sandbox.spy(mapCollection.clippingObjectManager, '_update');
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(update).to.have.been.called;
    });

    it('should add a listener to targetsUpdated, calling update', () => {
      sandbox.stub(mapCollection.clippingObjectManager._update, 'bind')
        .returns(() => mapCollection.clippingObjectManager._update());
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      const update = sandbox.spy(mapCollection.clippingObjectManager, '_update');
      clippingObject.targetsUpdated.raiseEvent();
      expect(update).to.have.been.called;
    });

    it('should add a listener to clippingPlaneUpdate, calling clippingPlaneUpdated', () => {
      sandbox.stub(mapCollection.clippingObjectManager._clippingPlaneUpdated, 'bind')
        .returns(() => mapCollection.clippingObjectManager._clippingPlaneUpdated());
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      const clippingPlaneUpdated = sandbox.spy(mapCollection.clippingObjectManager, '_clippingPlaneUpdated');
      clippingObject.clippingPlaneUpdated.raiseEvent();
      expect(clippingPlaneUpdated).to.have.been.called;
    });

    it('should throw, if the clipping object is already part of the default clipping objects', () => {
      mapCollection.clippingObjectManager.addClippingObject(clippingObject);
      expect(
        mapCollection.clippingObjectManager
          .setExclusiveClippingObjects.bind(mapCollection.clippingObjectManager, [clippingObject], cb),
      ).to.throw('Some ClippingObjects are already managed, remove them first');
    });

    it('should not throw, if the clipping object is part of the exclusive clipping objects', () => {
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
      expect(
        mapCollection.clippingObjectManager
          .setExclusiveClippingObjects.bind(mapCollection.clippingObjectManager, [clippingObject], cb),
      ).to.not.throw;
    });
  });

  describe('_clearExclusiveClippingObjects', () => {
    let clippingObject;
    let cb;

    beforeEach(() => {
      clippingObject = new ClippingObject();
      cb = sandbox.spy();
      mapCollection.clippingObjectManager.setExclusiveClippingObjects([clippingObject], cb);
    });

    it('should remove the exclusive clipping objects array', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      expect(mapCollection.clippingObjectManager._exclusiveClippingObjects).to.be.null;
    });

    it('should remove event listeners', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      expect(clippingObject.targetsUpdated.numberOfListeners).to.equal(0);
      expect(clippingObject.clippingPlaneUpdated.numberOfListeners).to.equal(0);
    });

    it('should remove the object from the listeners map', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      expect(mapCollection.clippingObjectManager._listenersMap.get(clippingObject)).to.be.undefined;
    });

    it('should call the callback', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      expect(cb).to.have.been.called;
    });

    it('should only call the callback once', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects();
      expect(cb).to.have.been.calledOnce;
    });

    it('should not call the callback if called silently', () => {
      mapCollection.clippingObjectManager._clearExclusiveClippingObjects(true);
      expect(cb).to.not.have.been.called;
    });
  });
});
