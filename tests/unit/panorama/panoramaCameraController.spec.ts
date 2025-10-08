import { expect } from 'chai';
import sinon from 'sinon';
import type { PerspectiveFrustum } from '@vcmap-cesium/engine';
import { Math as CesiumMath, Cartesian2 } from '@vcmap-cesium/engine';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';
import type { PanoramaCameraController } from '../../../src/panorama/panoramaCameraController.js';
import {
  MIN_FOV,
  MAX_FOV,
  MAX_PITCH,
  MIN_PITCH,
} from '../../../src/panorama/panoramaCameraController.js';
import type PanoramaMap from '../../../src/map/panoramaMap.js';
import {
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../src/interaction/interactionType.js';
import { replaceRequestAnimationFrame } from '../helpers/helpers.js';

describe('panoramaCameraController', () => {
  let map: PanoramaMap;
  let destroyImage: () => void;
  let controller: PanoramaCameraController;
  let sandbox: sinon.SinonSandbox;
  let requestAnimationFrameStub: {
    tick: () => void;
    cleanup: () => void;
  };

  beforeEach(async () => {
    requestAnimationFrameStub = replaceRequestAnimationFrame();
    map = getPanoramaMap();
    sandbox = sinon.createSandbox();
    controller = map.panoramaCameraController;
    const { panoramaImage, destroy } = await getPanoramaImage({
      fileName: 'badOrientation.tif', // forces heading and pitch to be set to 0
    });
    map.setCurrentImage(panoramaImage);
    map.getCesiumWidget().camera.setView({
      destination: panoramaImage.position,
      orientation: panoramaImage.orientation,
    });
    destroyImage = destroy;
    const { canvas } = map.getCesiumWidget().scene;
    sandbox.stub(canvas, 'clientWidth').get(() => 100);
    sandbox.stub(canvas, 'clientHeight').get(() => 50);
  });

  afterEach(() => {
    requestAnimationFrameStub.cleanup();
    map.destroy();
    destroyImage();
    sandbox.restore();
  });

  describe('zoomIn', () => {
    it('should decrease the frustum FOV when zooming in', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      const initialFov = frustum.fov;
      controller.zoomIn();
      expect(frustum.fov).to.lessThan(initialFov);
    });

    it('should respect the minimum FOV limit', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;

      controller.zoomIn(CesiumMath.TWO_PI);
      expect(frustum.fov).to.be.at.least(MIN_FOV);
    });

    it('should use the provided step value', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      const initialFov = frustum.fov;
      const step = 0.2;

      controller.zoomIn(step);

      expect(frustum.fov).to.equal(initialFov - step);
    });

    it('should call render, after zooming in', () => {
      const spy = sandbox.spy(map.panoramaView, 'render');
      controller.zoomIn();
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('zoomOut', () => {
    it('should increase the frustum FOV when zooming out', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      const initialFov = frustum.fov;

      controller.zoomOut();

      expect(frustum.fov).to.be.greaterThan(initialFov);
    });

    it('should respect the maximum FOV limit', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      controller.zoomOut(CesiumMath.TWO_PI);
      expect(frustum.fov).to.be.at.most(MAX_FOV);
    });

    it('should use the provided step value', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      const initialFov = frustum.fov;
      const step = 0.2;

      controller.zoomOut(step);

      expect(frustum.fov).to.equal(initialFov + step);
    });

    it('should call render, after zooming out', () => {
      const spy = sandbox.spy(map.panoramaView, 'render');
      controller.zoomOut();
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('pointer events', () => {
    it('should ensure pitch does not exceed maximum bounds', () => {
      const { camera } = map.getCesiumWidget();

      camera.setView({
        orientation: {
          pitch: MAX_PITCH - 0.1, // Just below the maximum
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(50, 12),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.DOWN,
      });
      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(50, 0),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        pointerEvent: PointerEventType.MOVE,
      });
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();

      expect(camera.pitch).to.be.closeTo(MAX_PITCH, CesiumMath.EPSILON8);
    });

    it('should ensure pitch does not go below minimum bounds', () => {
      const { camera } = map.getCesiumWidget();

      camera.setView({
        orientation: {
          pitch: MIN_PITCH + 0.1, // Just above the minimum
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(50, 30),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.DOWN,
      });
      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(50, 22),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        multipleTouch: false,
        pointerEvent: PointerEventType.MOVE,
      });
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();

      expect(camera.pitch).to.be.closeTo(MIN_PITCH, CesiumMath.EPSILON8);
    });

    it('should handle traversing the 0 meridian', () => {
      const { camera } = map.getCesiumWidget();
      camera.setView({
        orientation: {
          heading: 0,
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(0, 25),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.DOWN,
      });
      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(100, 50),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        multipleTouch: false,
        pointerEvent: PointerEventType.MOVE,
      });

      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();

      expect(camera.heading).to.be.closeTo(
        CesiumMath.PI + 3 * CesiumMath.PI_OVER_FOUR,
        CesiumMath.EPSILON6,
      );
    });

    it('should emulate inertia when dragging', () => {
      const { camera } = map.getCesiumWidget();
      camera.setView({
        orientation: {
          heading: 0,
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(0, 25),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.DOWN,
      });
      requestAnimationFrameStub.tick();

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(100, 50),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        multipleTouch: false,
        pointerEvent: PointerEventType.MOVE,
      });
      requestAnimationFrameStub.tick();

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(0, 25),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.UP,
      });
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();

      expect(camera.heading).to.be.lessThan(
        CesiumMath.PI + 3 * CesiumMath.PI_OVER_FOUR - 0.1,
      );
    });
  });

  describe('disabling the camera controller', () => {
    it('should not be active, when API movements are disabled on the map', () => {
      map.disableMovement({
        pointerEvents: true,
        apiCalls: false,
        keyEvents: false,
      });
      const { camera } = map.getCesiumWidget();
      camera.setView({
        orientation: {
          heading: CesiumMath.PI,
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(0, 25),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.DOWN,
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(100, 50),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        multipleTouch: false,
        pointerEvent: PointerEventType.MOVE,
      });

      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      expect(camera.heading).to.equal(CesiumMath.PI);
    });

    it('should not zoom in when API movements are disabled on the map', () => {
      const frustum = map.getCesiumWidget().camera
        .frustum as PerspectiveFrustum;
      const initialFov = frustum.fov;
      map.disableMovement({
        pointerEvents: false,
        apiCalls: true,
        keyEvents: false,
      });
      controller.zoomIn();
      expect(frustum.fov).to.equal(initialFov);
    });

    it('should not pan when the cesium default input is active', () => {
      const { camera, scene } = map.getCesiumWidget();
      scene.screenSpaceCameraController.enableInputs = true;
      camera.setView({
        orientation: {
          heading: CesiumMath.PI,
        },
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(0, 25),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
        multipleTouch: false,
        pointerEvent: PointerEventType.DOWN,
      });

      map.pointerInteractionEvent.raiseEvent({
        map,
        windowPosition: new Cartesian2(100, 50),
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        multipleTouch: false,
        pointerEvent: PointerEventType.MOVE,
      });

      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      requestAnimationFrameStub.tick();
      expect(camera.heading).to.equal(CesiumMath.PI);
    });
  });
});
