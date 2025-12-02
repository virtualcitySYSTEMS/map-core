import {
  type Camera,
  Cartesian3,
  Cartographic,
  type Cesium3DTileset,
  type CesiumWidget,
  type CustomDataSource,
  type CzmlDataSource,
  Ellipsoid,
  ImageryLayer,
  type ImageryLayerCollection,
  JulianDate,
  KeyboardEventModifier,
  Math as CesiumMath,
  PrimitiveCollection,
  Ray,
  RequestScheduler,
  type Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type TerrainProvider,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import VcsMap from './vcsMap.js';
import type Layer from '../layer/layer.js';
import type LayerCollection from '../util/layerCollection.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import Viewpoint from '../util/viewpoint.js';
import {
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';
import Projection from '../util/projection.js';

RequestScheduler.maximumRequestsPerServer = 12;

/**
 * Ensures, a primitive/imageryLayer/entity is part of a collection and placed at the correct location
 * @param  cesiumCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
function ensureInCollection<
  T extends PrimitiveCollection | ImageryLayerCollection,
>(
  cesiumCollection: T,
  item: T extends PrimitiveCollection
    ? PrimitiveCollection | Cesium3DTileset
    : ImageryLayer,
  layerCollection: LayerCollection,
): void {
  const targetIndex = layerCollection.indexOfKey(item[vcsLayerName]) as number;
  if (targetIndex > -1) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!cesiumCollection.contains(item)) {
      const primitivesLength = cesiumCollection.length;
      let index = primitivesLength;
      for (let i = 0; i < primitivesLength; i++) {
        const collectionItem = cesiumCollection.get(
          i,
        ) as T extends PrimitiveCollection
          ? PrimitiveCollection | Cesium3DTileset
          : ImageryLayer;
        if (
          (layerCollection.indexOfKey(collectionItem[vcsLayerName]) as number) >
          targetIndex
        ) {
          index = i;
          break;
        }
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      cesiumCollection.add(item, index);
    }
  }
}

/**
 * @param  primitiveCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
function indexChangedOnPrimitive(
  primitiveCollection: PrimitiveCollection,
  item: PrimitiveCollection,
  layerCollection: LayerCollection,
): void {
  const { destroyPrimitives } = primitiveCollection;
  primitiveCollection.destroyPrimitives = false;
  primitiveCollection.remove(item);
  ensureInCollection(primitiveCollection, item, layerCollection);
  primitiveCollection.destroyPrimitives = destroyPrimitives;
}

/**
 * @param  imageryLayerCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
function indexChangedOnImageryLayer(
  imageryLayerCollection: ImageryLayerCollection,
  item: ImageryLayer,
  layerCollection: LayerCollection,
): void {
  imageryLayerCollection.remove(item, false);
  ensureInCollection(imageryLayerCollection, item, layerCollection);
}

export function getResolution(
  cartesian: Cartesian3,
  camera: Camera,
  mapElement: HTMLElement,
  latitude?: number,
): number {
  const distance = Cartesian3.distance(cartesian, camera.position);
  const usedLatitude =
    latitude ?? Cartographic.fromCartesian(cartesian).latitude;

  const fov = Math.PI / 3.0;
  const width = mapElement.offsetWidth;
  const height = mapElement.offsetHeight;
  const aspectRatio = width / height;
  const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
  const visibleMeters = 2 * distance * Math.tan(fovy / 2);
  const relativeCircumference = Math.cos(Math.abs(usedLatitude));
  const visibleMapUnits = visibleMeters / relativeCircumference;

  return visibleMapUnits / height;
}

export type CesiumVisualisationType =
  | CustomDataSource
  | CzmlDataSource
  | PrimitiveCollection
  | Cesium3DTileset
  | ImageryLayer;

export default class BaseCesiumMap extends VcsMap<CesiumVisualisationType> {
  static get className(): string {
    return 'BaseCesiumMap';
  }

  protected _cesiumWidget: CesiumWidget | null = null;

  protected _terrainProvider: TerrainProvider | null | undefined = null;

  private _screenSpaceListener: (() => void) | undefined;

  screenSpaceEventHandler: ScreenSpaceEventHandler | null = null;

  defaultTerrainProvider: TerrainProvider | null = null;

  protected _listeners: (() => void)[] = [];

  get terrainProvider(): TerrainProvider | null | undefined {
    return this._terrainProvider;
  }

  protected _initializeCesiumWidget(widget: CesiumWidget): void {
    if (this._cesiumWidget) {
      throw new Error('CesiumWidget already initialized');
    }
    this._cesiumWidget = widget;
    this._cesiumWidget.clock.currentTime = JulianDate.fromDate(
      new Date(new Date().getFullYear(), 6, 20, 13, 0, 0, 0),
    );
    this.screenSpaceEventHandler = new ScreenSpaceEventHandler(
      this._cesiumWidget.scene.canvas,
    );
    this._setupCesiumInteractions();

    this.defaultTerrainProvider = this._cesiumWidget.scene.terrainProvider;
    this._terrainProvider = this.defaultTerrainProvider;
    this._listeners.push(
      this._cesiumWidget.scene.terrainProviderChanged.addEventListener(
        this._terrainProviderChanged.bind(this),
      ),
    );

    this._cesiumWidget.scene.frameState.creditDisplay.update = (): void => {};
    this._cesiumWidget.scene.frameState.creditDisplay.beginFrame =
      (): void => {};
    this._cesiumWidget.scene.frameState.creditDisplay.endFrame = (): void => {};

    // hide default cesium credits container
    const creditsContainer = document.getElementsByClassName(
      'cesium-widget-credits',
    );
    if (creditsContainer) {
      for (let i = 0; i < creditsContainer.length; i++) {
        const element = creditsContainer[i] as HTMLElement;
        element.style.display = 'none';
      }
    }

    this._listeners.push(
      this._cesiumWidget.scene.postRender.addEventListener(
        (eventScene: Scene, time: JulianDate) => {
          this.postRender.raiseEvent({
            map: this,
            originalEvent: { scene: eventScene, time },
          });
        },
      ),
    );
  }

  override async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  override deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  override getViewpoint(): Promise<null | Viewpoint> {
    return Promise.resolve(this.getViewpointSync());
  }

  override getViewpointSync(): Viewpoint | null {
    if (!this._cesiumWidget || !this._cesiumWidget.scene || !this.target) {
      return null;
    }
    const cam = this._cesiumWidget.scene.camera;
    const cameraPositionCartesian = cam.position;
    let groundPosition;
    let distance;

    const groundPositionCartesian = this._cesiumWidget.scene.globe?.pick(
      new Ray(cam.position, cam.direction),
      this._cesiumWidget.scene,
    );

    if (groundPositionCartesian) {
      distance = Cartesian3.distance(
        groundPositionCartesian,
        cameraPositionCartesian,
      );
      const groundPositionCartographic =
        Ellipsoid.WGS84.cartesianToCartographic(groundPositionCartesian);
      groundPosition = [
        CesiumMath.toDegrees(groundPositionCartographic.longitude),
        CesiumMath.toDegrees(groundPositionCartographic.latitude),
        groundPositionCartographic.height,
      ];
    }

    const cameraPositionCartographic = cam.positionCartographic;
    const cameraPosition = [
      CesiumMath.toDegrees(cameraPositionCartographic.longitude),
      CesiumMath.toDegrees(cameraPositionCartographic.latitude),
      cameraPositionCartographic.height,
    ];

    return new Viewpoint({
      groundPosition,
      cameraPosition,
      distance,
      heading: CesiumMath.toDegrees(cam.heading),
      pitch: CesiumMath.toDegrees(cam.pitch),
      roll: CesiumMath.toDegrees(cam.roll),
    });
  }

  private _getCurrentResolutionFromCartesianLatitude(
    cartesian: Cartesian3,
    latitude?: number,
  ): number {
    if (!this._cesiumWidget) {
      return 1;
    }

    return getResolution(
      cartesian,
      this._cesiumWidget.camera,
      this.mapElement,
      latitude,
    );
  }

  getCurrentResolution(coordinate: Coordinate): number {
    const wgs84Coordinate = Projection.mercatorToWgs84(coordinate);
    const cartesian = Cartesian3.fromDegrees(
      wgs84Coordinate[0],
      wgs84Coordinate[1],
      wgs84Coordinate[2],
    );
    return this._getCurrentResolutionFromCartesianLatitude(
      cartesian,
      CesiumMath.toRadians(wgs84Coordinate[1]),
    );
  }

  getCurrentResolutionFromCartesian(cartesian: Cartesian3): number {
    return this._getCurrentResolutionFromCartesianLatitude(cartesian);
  }

  private _setupCesiumInteractions(): void {
    const scene = this.getScene()!;
    const raisePointerInteraction = (
      key: ModificationKeyType,
      pointer: number,
      pointerEvent: PointerEventType,
      csEvent:
        | ScreenSpaceEventHandler.PositionedEvent
        | ScreenSpaceEventHandler.MotionEvent,
    ): void => {
      const multipleTouch =
        // eslint-disable-next-line no-underscore-dangle
        (this.screenSpaceEventHandler?._positions?.length ?? 0) > 1;
      const windowPosition = (
        csEvent as ScreenSpaceEventHandler.PositionedEvent
      ).position
        ? (csEvent as ScreenSpaceEventHandler.PositionedEvent).position
        : (csEvent as ScreenSpaceEventHandler.MotionEvent).endPosition;

      this.pointerInteractionEvent.raiseEvent({
        map: this,
        windowPosition,
        key,
        pointer,
        multipleTouch,
        pointerEvent,
      });
    };

    const mods = [
      {
        csModifier: KeyboardEventModifier.ALT,
        vcsModifier: ModificationKeyType.ALT,
      },
      {
        csModifier: KeyboardEventModifier.CTRL,
        vcsModifier: ModificationKeyType.CTRL,
      },
      {
        csModifier: KeyboardEventModifier.SHIFT,
        vcsModifier: ModificationKeyType.SHIFT,
      },
      { csModifier: undefined, vcsModifier: ModificationKeyType.NONE },
    ];

    const types = [
      {
        type: ScreenSpaceEventType.LEFT_DOWN,
        pointerEvent: PointerEventType.DOWN,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: ScreenSpaceEventType.LEFT_UP,
        pointerEvent: PointerEventType.UP,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: ScreenSpaceEventType.RIGHT_DOWN,
        pointerEvent: PointerEventType.DOWN,
        pointer: PointerKeyType.RIGHT,
      },
      {
        type: ScreenSpaceEventType.RIGHT_UP,
        pointerEvent: PointerEventType.UP,
        pointer: PointerKeyType.RIGHT,
      },
      {
        type: ScreenSpaceEventType.MIDDLE_DOWN,
        pointerEvent: PointerEventType.DOWN,
        pointer: PointerKeyType.MIDDLE,
      },
      {
        type: ScreenSpaceEventType.MIDDLE_UP,
        pointerEvent: PointerEventType.UP,
        pointer: PointerKeyType.MIDDLE,
      },
      {
        type: ScreenSpaceEventType.MOUSE_MOVE,
        pointerEvent: PointerEventType.MOVE,
        pointer: PointerKeyType.ALL,
      },
    ];
    let lastEventFrameNumber = 0;
    const screenSpaceListeners = types
      .map(({ pointerEvent, pointer, type }) => {
        return mods.map(({ csModifier, vcsModifier }) => {
          const handler:
            | ScreenSpaceEventHandler.PositionedEventCallback
            | ScreenSpaceEventHandler.MotionEventCallback =
            type === ScreenSpaceEventType.MOUSE_MOVE
              ? (csEvent: ScreenSpaceEventHandler.MotionEvent): void => {
                  if (scene.frameState.frameNumber !== lastEventFrameNumber) {
                    lastEventFrameNumber = scene.frameState.frameNumber;
                    raisePointerInteraction(
                      vcsModifier,
                      pointer,
                      pointerEvent,
                      csEvent,
                    );
                  }
                }
              : (csEvent: ScreenSpaceEventHandler.PositionedEvent): void => {
                  raisePointerInteraction(
                    vcsModifier,
                    pointer,
                    pointerEvent,
                    csEvent,
                  );
                };

          this.screenSpaceEventHandler!.setInputAction?.(
            handler,
            type,
            csModifier,
          );
          return (): void => {
            this.screenSpaceEventHandler?.removeInputAction?.(type, csModifier);
          };
        });
      })
      .flat();

    this._screenSpaceListener = (): void => {
      screenSpaceListeners.forEach((removeListener) => {
        removeListener();
      });
    };
  }

  /**
   * returns the cesium Widget Object
   */
  getCesiumWidget(): CesiumWidget | null {
    return this._cesiumWidget;
  }

  /**
   * returns the cesium Scene Object, returns null on non initialized or destroyed maps
   */
  getScene(): Scene | undefined {
    return this._cesiumWidget?.scene;
  }

  protected _indexChangedOnVisualization(vis: CesiumVisualisationType): void {
    if (vis instanceof PrimitiveCollection) {
      indexChangedOnPrimitive(
        (this.getScene() as Scene).primitives,
        vis,
        this.layerCollection,
      );
    } else if (vis instanceof ImageryLayer) {
      indexChangedOnImageryLayer(
        (this.getScene() as Scene).imageryLayers,
        vis,
        this.layerCollection,
      );
    }
  }

  override indexChanged(layer: Layer): void {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach((item) => {
        this._indexChangedOnVisualization(item);
      });
    }
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param  primitiveCollection
   */
  addPrimitiveCollection(
    primitiveCollection: PrimitiveCollection | Cesium3DTileset,
  ): void {
    if (!this._cesiumWidget) {
      throw new Error('Cannot add primitive to uninitialized map');
    }
    if (this.validateVisualization(primitiveCollection)) {
      this.addVisualization(primitiveCollection);
      ensureInCollection(
        this._cesiumWidget.scene.primitives,
        primitiveCollection,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API to unregister the visualization for a layers implementation
   * @param  primitiveCollection
   */
  removePrimitiveCollection(
    primitiveCollection: PrimitiveCollection | Cesium3DTileset,
  ): void {
    // XXX add destroy as boolean?
    this.removeVisualization(primitiveCollection);
    this.getScene()?.primitives.remove(primitiveCollection);
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param  imageryLayer
   */
  addImageryLayer(imageryLayer: ImageryLayer): void {
    if (!this._cesiumWidget) {
      throw new Error('Cannot add primitive to uninitialized map');
    }
    if (this.validateVisualization(imageryLayer)) {
      this.addVisualization(imageryLayer);
      ensureInCollection(
        this._cesiumWidget.scene.imageryLayers,
        imageryLayer,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API used to unregister visualizations from layer implementations
   */
  removeImageryLayer(imageryLayer: ImageryLayer): void {
    this.removeVisualization(imageryLayer);
    this.getScene()?.imageryLayers.remove(imageryLayer);
  }

  /**
   * set the cesium TerrainProvider
   */
  setTerrainProvider(terrainProvider: TerrainProvider): void {
    if (this.terrainProvider !== terrainProvider && this._cesiumWidget) {
      this._cesiumWidget.scene.terrainProvider = terrainProvider;
    }
  }

  /**
   * unsets the TerrainProvider (changes to the default TerrainProvider if the given terranProvider is currently active)
   */
  unsetTerrainProvider(terrainProvider: TerrainProvider): void {
    if (this.terrainProvider === terrainProvider) {
      this._terrainProvider = this.defaultTerrainProvider;
      if (this._cesiumWidget && this.defaultTerrainProvider) {
        this._cesiumWidget.scene.terrainProvider = this.defaultTerrainProvider;
      }
    }
  }

  /**
   * is called when the cesium Terrainprovider changes. Sets the .terrainProvider and deactivates currently
   * active TerrainLayer layer if necessary
   */
  private _terrainProviderChanged(terrainProvider: TerrainProvider): void {
    if (this.terrainProvider !== terrainProvider) {
      const layer = this.layerCollection.getByKey(
        this?.terrainProvider?.[vcsLayerName],
      );
      this._terrainProvider = terrainProvider;
      if (layer) {
        layer.deactivate();
      }
    }
  }

  override destroy(): void {
    this._listeners.forEach((cb) => {
      cb();
    });
    this._listeners = [];
    this._screenSpaceListener?.();

    this.screenSpaceEventHandler?.destroy();
    this.screenSpaceEventHandler = null;

    this._terrainProvider = null;
    this.defaultTerrainProvider = null;

    super.destroy();

    this._cesiumWidget?.destroy(); // destroy widget last to not throw
    this._cesiumWidget = null;
  }
}
