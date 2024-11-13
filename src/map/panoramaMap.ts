import {
  Cartesian2,
  Cartesian3,
  CesiumWidget,
  KeyboardEventModifier,
  Math as CesiumMath,
  Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  ShadowMode,
} from '@vcmap-cesium/engine';
import VcsMap, { VcsMapOptions } from './vcsMap.js';
import PanoramaImage from '../panorama/panoramaImage.js';
import { mapClassRegistry } from '../classRegistry.js';

export type PanoramaMapOptions = VcsMapOptions;

type PointerInput = {
  startPosition: Cartesian2;
  position: Cartesian2;
  leftDown: boolean;
};

const maxPitch = 85 / CesiumMath.DEGREES_PER_RADIAN;
const minPitch = -maxPitch;

function setupNavigationControls(widget: CesiumWidget): void {
  const pointerInput: PointerInput = {
    startPosition: new Cartesian2(),
    position: new Cartesian2(),
    leftDown: false,
  };

  const pointerEventHandler = new ScreenSpaceEventHandler(widget.canvas);

  const leftDownHandler = (event: { position: Cartesian2 }): void => {
    pointerInput.leftDown = true;
    pointerInput.startPosition = Cartesian2.clone(event.position);
    pointerInput.position = pointerInput.startPosition;
  };
  const leftUpHandler = (): void => {
    pointerInput.leftDown = false;
  };
  const mouseMoveHandler = (event: { endPosition: Cartesian2 }): void => {
    pointerInput.position = event.endPosition;
  };

  function setupMouseEventForAllKeyModifiers(
    eventType: ScreenSpaceEventType,
    handler:
      | ScreenSpaceEventHandler.MotionEventCallback
      | ScreenSpaceEventHandler.PositionedEventCallback,
  ): () => void {
    const removeCallbacks: Array<() => void> = [];
    [
      undefined,
      KeyboardEventModifier.SHIFT,
      KeyboardEventModifier.CTRL,
      KeyboardEventModifier.ALT,
    ].forEach(
      (keyModifier) => {
        pointerEventHandler.setInputAction(handler, eventType, keyModifier);
      },
      removeCallbacks.push(() => {
        pointerEventHandler.removeInputAction(eventType);
      }),
    );
    return () => {
      removeCallbacks.forEach((cb) => cb());
    };
  }

  const removeLeftDown = setupMouseEventForAllKeyModifiers(
    ScreenSpaceEventType.LEFT_DOWN,
    leftDownHandler,
  );
  const removeLeftUp = setupMouseEventForAllKeyModifiers(
    ScreenSpaceEventType.LEFT_UP,
    leftUpHandler,
  );
  const removeMouseMove = setupMouseEventForAllKeyModifiers(
    ScreenSpaceEventType.MOUSE_MOVE,
    mouseMoveHandler,
  );

  const removeScreenSpaceHandler = () => {
    removeLeftDown();
    removeLeftUp();
    removeMouseMove();
    pointerEventHandler.destroy();
  };

  const shareToAngleFactor = 0.05;

  const clockListener = widget.clock.onTick.addEventListener(() => {
    if (pointerInput.leftDown) {
      const { clientWidth, clientHeight } = widget.canvas;
      const { position, startPosition } = pointerInput;

      /** Distance of current pointer position to the initial/start position on leftDown as share of clientWidth */
      const xShare = (position.x - startPosition.x) / clientWidth;
      /** Distance of current pointer position to the initial/start position on leftDown as share of clientHeight */
      const yShare = -(position.y - startPosition.y) / clientHeight;

      widget.camera.look(widget.camera.position, xShare * shareToAngleFactor);
      const yAmount = yShare * shareToAngleFactor;
      if (
        widget.camera.pitch + yAmount > minPitch &&
        widget.camera.pitch + yAmount < maxPitch
      ) {
        widget.camera.lookUp(yAmount);
      }
    }
  });

  return (): void => {
    removeScreenSpaceHandler();
    clockListener();
  };
}

export default class PanoramaMap extends VcsMap {
  static get className(): string {
    return 'PanoramaMap';
  }

  static getDefaultOptions(): PanoramaMapOptions {
    return {
      ...VcsMap.getDefaultOptions(),
    };
  }

  private _cesiumWidget: CesiumWidget | undefined;

  private _currentImage: PanoramaImage | undefined;

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        baseLayer: false,
        shadows: false,
        terrainShadows: ShadowMode.ENABLED,
      });

      // Allow rotation only, disabling other camera movements
      this._cesiumWidget.scene.screenSpaceCameraController.enableInputs = false; // Disable translation
      this._cesiumWidget.scene.primitives.destroyPrimitives = false;
      this._cesiumWidget.scene.camera.setView({
        destination: Cartesian3.fromDegrees(0.0, 0.0, 0.0),
        orientation: {
          heading: 0.0,
          pitch: 0.0,
          roll: 0.0,
        },
      });

      console.log(
        this._cesiumWidget.camera.up,
        this._cesiumWidget.camera.right,
      );

      setupNavigationControls(this._cesiumWidget);
      this.setCurrentImage(
        new PanoramaImage({
          url: 'exampleData/Trimble_MX60_Hannover_Beispiel/pano_000001_000011.jpg',
        }),
      );
    }
    await super.initialize();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  setCurrentImage(image: PanoramaImage): void {
    if (this._currentImage) {
      this._cesiumWidget?.scene.primitives.remove(
        this._currentImage.getPrimitive(),
      );
    }
    this._currentImage = image;
    this._cesiumWidget?.scene.primitives.add(image.getPrimitive());
  }

  deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }
}
mapClassRegistry.registerClass(PanoramaMap.className, PanoramaMap);
