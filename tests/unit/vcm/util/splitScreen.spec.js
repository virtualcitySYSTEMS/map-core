import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import ImagerySplitDirection from '@vcmap/cesium/Source/Scene/ImagerySplitDirection.js';
import { getFramework } from '../../helpers/framework.js';
import { createInitializedTilesetLayer, getCesiumEventSpy, setCesiumMap } from '../../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../../helpers/openlayers.js';
import resetFramework from '../../helpers/resetFramework.js';

/**
 * @param {vcs.vcm.event.VcsEvent} event
 * @param {boolean=} raise
 * @returns {Promise<void>}
 */
function waitForEvent(event, raise) {
  return new Promise((resolve) => {
    const remover = event.addEventListener(() => {
      remover();
      resolve();
    });

    if (raise) {
      event.raiseEvent();
    }
  });
}

describe('vcs.vcm.util.SplitScreen', () => {
  let sandbox;
  /** @type {vcs.vcm.util.SplitScreen} */
  let splitScreen;
  let cesiumMap;
  let openlayers;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    openlayers = await setOpenlayersMap(getFramework());
    cesiumMap = await setCesiumMap(getFramework());
    ({ splitScreen } = getFramework().mapCollection);
  });

  afterEach(() => {
    resetFramework();
    sandbox.restore();
  });

  describe('position', () => {
    it('should return _position', () => {
      splitScreen._positon = 0.1;
      expect(splitScreen.position).to.equal(splitScreen._position);
    });

    it('should set position', () => {
      splitScreen.position = 0.6;
      expect(splitScreen.position).to.equal(0.6);
    });

    it('should throw, when setting bellow 0', () => {
      function setBellowZero() {
        splitScreen.position = -1;
      }

      expect(setBellowZero).to.throw('Position must be between 0 and 1');
    });

    it('should throw, when setting above 1', () => {
      function setAboveZero() {
        splitScreen.position = 2;
      }

      expect(setAboveZero).to.throw('Position must be between 0 and 1');
    });

    it('should call _updatePosition', () => {
      const updatePosition = sandbox.spy(splitScreen, '_updatePosition');
      splitScreen.position += 0.1;
      expect(updatePosition).to.have.been.called;
    });

    it('should not call updatePosition, if the delta is too small', () => {
      const updatePosition = sandbox.spy(splitScreen, '_updatePosition');
      splitScreen.position += 0.00001;
      expect(updatePosition).to.not.have.been.called;
    });
  });

  describe('constructor', () => {
    it('should add left and right clippingObjects to the default clippingObjects', () => {
      const { clippingObjectManager } = getFramework().mapCollection;
      expect(clippingObjectManager.hasClippingObject(splitScreen.leftScreenClippingObject)).to.be.true;
      expect(clippingObjectManager.hasClippingObject(splitScreen.rightScreenClippingObject)).to.be.true;
    });

    it('should add targets changed listeners to left and right clippingObjects', () => {
      const targetsChanged = sandbox.spy(splitScreen, '_targetsChanged');
      const spy = getCesiumEventSpy(sandbox, splitScreen.leftScreenClippingObject.targetsUpdated);
      splitScreen.leftScreenClippingObject.terrain = true;
      splitScreen.rightScreenClippingObject.terrain = true;
      expect(spy).to.have.been.called;
      expect(targetsChanged).to.have.been.calledTwice;
    });
  });

  describe('_targetsChanged', () => {
    let layer;

    beforeEach(async () => {
      layer = await createInitializedTilesetLayer(sandbox, cesiumMap);
      await layer.activate();
      getFramework().addLayer(layer);
    });

    describe('targets added', () => {
      let changedPromise;
      beforeEach(() => {
        changedPromise = waitForEvent(splitScreen.leftScreenClippingObject.targetsUpdated);
      });

      it('should cache the original camera changed', async () => {
        const original = cesiumMap.getScene().camera.percentageChanged;
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        await changedPromise;
        expect(splitScreen).to.have.property('originalCameraPercentageChanged', original);
      });

      it('should set the current cameras percentage changed to zero', async () => {
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        await changedPromise;
        expect(cesiumMap.getScene().camera).to.have.property('percentageChanged', 0);
      });

      it('should add a camera changed event listener, calling _updateClippingPlanes', async () => {
        const updateClippingPlanes = sandbox.spy(splitScreen, '_updateClippingPlanes');
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        await changedPromise;
        updateClippingPlanes.resetHistory();
        await waitForEvent(cesiumMap.getScene().camera.changed, true);
        expect(updateClippingPlanes).to.have.been.calledOnce;
      });

      it('should call _updateClippingPlanes', async () => {
        const updateClippingPlanes = sandbox.spy(splitScreen, '_updateClippingPlanes');
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        await changedPromise;
        expect(updateClippingPlanes).to.have.been.calledOnce;
      });

      it('should do nothing on a second target', async () => {
        const updateClippingPlanes = sandbox.spy(splitScreen, '_updateClippingPlanes');
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        await changedPromise;
        updateClippingPlanes.resetHistory();
        const waiter = waitForEvent(splitScreen.rightScreenClippingObject.targetsUpdated);
        splitScreen.rightScreenClippingObject.addLayer(layer.name);
        await waiter;
        expect(updateClippingPlanes).to.not.have.been.called;
      });
    });

    describe('targets cleared', () => {
      beforeEach(() => {
        const waiter = waitForEvent(splitScreen.leftScreenClippingObject.targetsUpdated);
        splitScreen.leftScreenClippingObject.addLayer(layer.name);
        return waiter;
      });

      it('should call the camera removed callback', async () => {
        const newListener = sandbox.spy();
        splitScreen._cameraListener();
        splitScreen._cameraListener = newListener;
        const waiter = waitForEvent(splitScreen.leftScreenClippingObject.targetsUpdated);
        splitScreen.leftScreenClippingObject.removeLayer(layer.name);
        await waiter;
        expect(newListener).to.have.been.called;
      });

      it('should set the _cameraListener to null', async () => {
        const waiter = waitForEvent(splitScreen.leftScreenClippingObject.targetsUpdated);
        splitScreen.leftScreenClippingObject.removeLayer(layer.name);
        await waiter;
        expect(splitScreen).to.have.property('_cameraListener', null);
      });

      it('should set the originalCameraPercentageChanged', async () => {
        const waiter = waitForEvent(splitScreen.leftScreenClippingObject.targetsUpdated);
        splitScreen.leftScreenClippingObject.removeLayer(layer.name);
        await waiter;
        expect(cesiumMap.getScene().camera).to.have.property('percentageChanged', splitScreen.originalCameraPercentageChanged);
      });
    });
  });

  describe('_updatePosition', () => {
    it('should set the position', () => {
      splitScreen._updatePosition(0.1);
      expect(splitScreen.position).to.equal(0.1);
    });

    describe('Cesium', () => {
      it('should set the scenes imagerySplitPosition', () => {
        splitScreen._updatePosition(0.1);
        expect(cesiumMap.getScene()).to.have.property('imagerySplitPosition', 0.1);
      });

      it('should call _updateClippingPlanes', () => {
        const updateClippingPlanes = sandbox.spy(splitScreen, '_updateClippingPlanes');
        splitScreen._updatePosition(0.1);
        expect(updateClippingPlanes).to.have.been.calledOnce;
      });
    });

    describe('Openlayers', () => {
      it('should call render on the map', () => {
        splitScreen.mapActivated(openlayers);
        const render = sandbox.spy(splitScreen.olMap, 'render');
        splitScreen._updatePosition(0.1);
        expect(render).to.have.been.called;
      });
    });
  });

  describe('mapActivated', () => {
    it('should call _updatePosition with the current position', () => {
      const updatePosition = sandbox.spy(splitScreen, '_updatePosition');
      splitScreen.mapActivated(cesiumMap);
      expect(updatePosition).to.have.been.calledWithExactly(splitScreen.position);
    });

    describe('Cesium', () => {
      it('should set the scene', () => {
        splitScreen.mapActivated(cesiumMap);
        expect(splitScreen).to.have.property('scene', cesiumMap.getScene());
      });

      it('should set the olMap to null', () => {
        splitScreen.olMap = true;
        splitScreen.mapActivated(cesiumMap);
        expect(splitScreen.olMap).to.be.null;
      });

      it('should call _targetsChanged', () => {
        const targetsChanged = sandbox.spy(splitScreen, '_targetsChanged');
        splitScreen.mapActivated(cesiumMap);
        expect(targetsChanged).to.have.been.called;
      });
    });

    describe('Openlayers', () => {
      it('should set the olMap property', () => {
        splitScreen.mapActivated(openlayers);
        expect(splitScreen).to.have.property('olMap', openlayers.olMap);
      });

      it('should set the scene to null', () => {
        splitScreen.scene = true;
        splitScreen.mapActivated(openlayers);
        expect(splitScreen.scene).to.be.null;
      });
    });
  });

  describe('_updateClippingPlanes', () => {
    let clippingPlane;
    beforeEach(() => {
      clippingPlane = splitScreen._calcClippingPlane();
      sandbox.stub(splitScreen, '_calcClippingPlane').returns(clippingPlane);
    });

    it('should set the clipping plane on the left clippingPlaneCollection', () => {
      splitScreen._updateClippingPlanes();
      expect(splitScreen.leftScreenClippingObject.clippingPlaneCollection.get(0)).to.equal(clippingPlane);
    });

    it('should apply a negated clone to the right side', () => {
      splitScreen._updateClippingPlanes();
      const rightPlane = splitScreen.rightScreenClippingObject.clippingPlaneCollection.get(0);
      expect(rightPlane.distance).to.equal(clippingPlane.distance * -1);
      const negatedNormal = Cartesian3.negate(clippingPlane.normal, new Cartesian3());
      expect(negatedNormal.equals(rightPlane.normal)).to.be.true;
    });
  });

  describe('getClippingObjectForDirection', () => {
    it('should return the leftClippingPlaneCollection', () => {
      const left = splitScreen.getClippingObjectForDirection(ImagerySplitDirection.LEFT);
      expect(left).to.equal(splitScreen.leftScreenClippingObject);
    });

    it('should return the rightScreenClippingObject', () => {
      const right = splitScreen.getClippingObjectForDirection(ImagerySplitDirection.RIGHT);
      expect(right).to.equal(splitScreen.rightScreenClippingObject);
    });

    it('should return null for NONE', () => {
      const none = splitScreen.getClippingObjectForDirection(ImagerySplitDirection.NONE);
      expect(none).to.be.null;
    });
  });

  describe('destroy', () => {
    it('should remove both clipping planes', () => {
      splitScreen.destroy();
      const { clippingObjectManager } = getFramework().mapCollection;
      expect(clippingObjectManager.hasClippingObject(splitScreen.leftScreenClippingObject)).to.be.false;
      expect(clippingObjectManager.hasClippingObject(splitScreen.rightScreenClippingObject)).to.be.false;
    });

    it('should remove any target listeners', () => {
      const targetsChanged = sandbox.spy(splitScreen, '_targetsChanged');
      splitScreen.destroy();
      splitScreen.leftScreenClippingObject.terrain = true;
      splitScreen.rightScreenClippingObject.terrain = true;
      expect(targetsChanged).to.not.have.been.called;
    });

    it('should remove the camera listener', () => {
      const listener = sandbox.spy();
      splitScreen._cameraListener = listener;
      splitScreen.destroy();
      expect(listener).to.have.been.called;
      expect(splitScreen._cameraListener).to.be.null;
    });
  });
});
