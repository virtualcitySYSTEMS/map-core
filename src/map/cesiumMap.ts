import {
  JulianDate,
  Clock,
  DataSourceClock,
  Color,
  CesiumWidget,
  ShadowMode,
  DataSourceDisplay,
  DataSourceCollection,
  RequestScheduler,
  Ellipsoid,
  ScreenSpaceEventHandler,
  Cartesian3,
  Ray,
  Math as CesiumMath,
  Camera,
  BillboardVisualizer,
  LabelVisualizer,
  PointVisualizer,
  CustomDataSource,
  BoundingSphere,
  Intersect,
  ImageryLayer,
  PrimitiveCollection,
  KeyboardEventModifier,
  ScreenSpaceEventType,
  Cartographic,
  type Scene,
  type ImageryLayerCollection,
  type Cesium3DTileset,
  type TerrainProvider,
  type Event as CesiumEvent,
  type CzmlDataSource,
  type CesiumTerrainProvider,
  type EntityCollection,
  type EntityCluster,
  type DataSource,
  type Visualizer,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';

import { checkMaybe } from '@vcsuite/check';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import VcsMap, { type VcsMapOptions } from './vcsMap.js';
import Viewpoint from '../util/viewpoint.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import {
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../interaction/interactionType.js';
import CameraLimiter, { CameraLimiterOptions } from './cameraLimiter.js';
import { mapClassRegistry } from '../classRegistry.js';
import type LayerCollection from '../util/layerCollection.js';
import type Layer from '../layer/layer.js';

export type CesiumMapOptions = VcsMapOptions & {
  /**
   * if true, lighting will be activated.
   */
  enableLightning?: boolean;
  /**
   * the tilecache size of cesium terrain and tile layer
   */
  tileCacheSize?: number;
  /**
   * activates webGL antialiasing (not every Browser respects this value)
   */
  webGLaa?: boolean;
  cameraLimiter?: CameraLimiterOptions;
  /**
   * the color of the globe, if no image is provided
   */
  globeColor?: string;
};

export type CesiumMapEvent = {
  scene: Scene;
  time: JulianDate;
};

/**
 * Ensures, a primitive/imageryLayer/entity is part of a collection and placed at the correct location
 * @param  cesiumCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
export function ensureInCollection<
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
 * @param  dataSourceCollection
 * @param  dataSource
 * @param  layerCollection
 * @private
 */
export async function ensureInDataSourceCollection(
  dataSourceCollection: DataSourceCollection,
  dataSource: CustomDataSource,
  layerCollection: LayerCollection,
): Promise<void> {
  const targetIndex = layerCollection.indexOfKey(
    dataSource[vcsLayerName],
  ) as number;
  if (targetIndex > -1) {
    if (!dataSourceCollection.contains(dataSource)) {
      await dataSourceCollection.add(dataSource);
    }

    const dataSourceLength = dataSourceCollection.length;
    let index = dataSourceLength;
    for (let i = 0; i < dataSourceLength; i++) {
      const collectionItem = dataSourceCollection.get(i);
      if (
        (layerCollection.indexOfKey(collectionItem[vcsLayerName]) as number) >
        targetIndex
      ) {
        index = i;
        break;
      }
    }
    let actualIndex = dataSourceCollection.indexOf(dataSource);

    if (index > actualIndex) {
      index -= 1;
    }
    if (actualIndex < index) {
      while (actualIndex < index) {
        dataSourceCollection.raise(dataSource);
        actualIndex = dataSourceCollection.indexOf(dataSource);
      }
    } else if (actualIndex > index) {
      while (actualIndex > index) {
        dataSourceCollection.lower(dataSource);
        actualIndex = dataSourceCollection.indexOf(dataSource);
      }
    }
  }
}

/**
 * @param  primitiveCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
export function indexChangedOnPrimitive(
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
export function indexChangedOnImageryLayer(
  imageryLayerCollection: ImageryLayerCollection,
  item: ImageryLayer,
  layerCollection: LayerCollection,
): void {
  imageryLayerCollection.remove(item, false);
  ensureInCollection(imageryLayerCollection, item, layerCollection);
}

/**
 * @param  dataSourceCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
export function indexChangedOnDataSource(
  dataSourceCollection: DataSourceCollection,
  item: CustomDataSource,
  layerCollection: LayerCollection,
): void {
  // eslint-disable-next-line no-void
  void ensureInDataSourceCollection(
    dataSourceCollection,
    item,
    layerCollection,
  );
}

/**
 * @param  source
 * @param  target
 * @private
 */
export function synchronizeClock(
  source: DataSourceClock,
  target: Clock,
): CesiumEvent.RemoveCallback {
  target.clockRange = source.clockRange;
  target.clockStep = source.clockStep;
  target.multiplier = source.multiplier;
  if (
    !target.startTime ||
    !target.startTime.equals(source.startTime) ||
    !target.stopTime ||
    !target.stopTime.equals(source.stopTime)
  ) {
    target.startTime = source.startTime;
    target.stopTime = source.stopTime;
    target.currentTime = source.currentTime;
  }
  return source.definitionChanged.addEventListener(
    <T extends keyof Clock>(_e: unknown, prop: T, value: Clock[T]) => {
      target[prop] = value;
    },
  );
}

export type CesiumVisualisationType =
  | CustomDataSource
  | CzmlDataSource
  | PrimitiveCollection
  | Cesium3DTileset
  | ImageryLayer;

/**
 * Cesium Globe Map Class (3D map)
 * @group Map
 */
class CesiumMap extends VcsMap<CesiumVisualisationType> {
  static get className(): string {
    return 'CesiumMap';
  }

  static getDefaultOptions(): CesiumMapOptions {
    return {
      ...VcsMap.getDefaultOptions(),
      enableLightning: true,
      tileCacheSize: 1,
      webGLaa: false,
      cameraLimiter: undefined,
      globeColor: '#3f47cc',
    };
  }

  private _cesiumWidget: CesiumWidget | null;

  dataSourceDisplay: DataSourceDisplay | null;

  /**
   * clock for animated data
   */
  dataSourceDisplayClock: Clock;

  /**
   * default clock is set, when no datasource clock is active
   */
  private _defaultClock: DataSourceClock;

  /**
   * clocks of active data sources
   * the last clock of the array corresponds to the active dataSourceDisplayClock
   */
  private _dataSourceClocks: DataSourceClock[];

  enableLightning: boolean;

  tileCacheSize: number;

  screenSpaceEventHandler: ScreenSpaceEventHandler | null;

  private _screenSpaceListeners: (() => void)[];

  defaultJDate: JulianDate;

  webGLaa: boolean;

  globeColor: Color;

  private _clusterDataSourceDisplay: DataSourceDisplay | null;

  private _terrainProvider: TerrainProvider | null;

  defaultTerrainProvider: TerrainProvider | null;

  private _cameraLimiter: CameraLimiter | null;

  private _cameraLimiterOptions: CameraLimiterOptions | undefined;

  private _preUpdateListener: (() => void) | null;

  private _clockSyncListener: (() => void) | null;

  private _listeners: (() => void)[];

  private _lastEventFrameNumber: number | null;

  constructor(options: CesiumMapOptions) {
    super(options);

    const defaultOptions = CesiumMap.getDefaultOptions();
    this._cesiumWidget = null;
    this.dataSourceDisplay = null;
    this.dataSourceDisplayClock = new Clock({ shouldAnimate: true });

    const defaultClock = new DataSourceClock();
    defaultClock.currentTime = this.dataSourceDisplayClock.currentTime;
    this._defaultClock = defaultClock;

    this._dataSourceClocks = [];

    this.enableLightning = parseBoolean(
      options.enableLightning,
      defaultOptions.enableLightning,
    );

    this.tileCacheSize = parseInteger(
      options.tileCacheSize,
      defaultOptions.tileCacheSize,
    );

    this.screenSpaceEventHandler = null;

    this._screenSpaceListeners = [];

    this.defaultJDate = JulianDate.fromDate(new Date(2014, 6, 20, 13, 0, 0, 0));

    this.webGLaa = parseBoolean(options.webGLaa, defaultOptions.webGLaa);

    this.globeColor = Color.fromCssColorString(
      options.globeColor || (defaultOptions.globeColor as string),
    );

    this._clusterDataSourceDisplay = null;

    this._terrainProvider = null;

    this.defaultTerrainProvider = null;

    this._cameraLimiter = null;

    this._cameraLimiterOptions =
      options.cameraLimiter || defaultOptions.cameraLimiter;

    this._preUpdateListener = null;

    this._clockSyncListener = null;

    this._listeners = [];

    this._lastEventFrameNumber = null;
  }

  get splitPosition(): number {
    return super.splitPosition;
  }

  set splitPosition(position: number) {
    super.splitPosition = position;
    if (this._cesiumWidget) {
      this._cesiumWidget.scene.splitPosition = position;
    }
  }

  get terrainProvider(): TerrainProvider | null {
    return this._terrainProvider;
  }

  /**
   * A camera limit to not allow the camera to get too close to the globe.
   */
  get cameraLimiter(): CameraLimiter | null {
    return this._cameraLimiter;
  }

  set cameraLimiter(limiter: CameraLimiter | null) {
    checkMaybe(limiter, CameraLimiter);

    if (this._cameraLimiter !== limiter) {
      this._cameraLimiter = limiter;
      if (
        this._cameraLimiter &&
        !this._preUpdateListener &&
        this._cesiumWidget
      ) {
        this._setupPreUpdateListener();
      } else if (!this._cameraLimiter && this._preUpdateListener) {
        this._preUpdateListener();
        this._preUpdateListener = null;
      }
    }
  }

  private _setupPreUpdateListener(): void {
    if (this._cesiumWidget) {
      this._preUpdateListener =
        this._cesiumWidget.scene.preUpdate.addEventListener(() => {
          if (this._cameraLimiter && this._cesiumWidget) {
            // eslint-disable-next-line no-void
            void this._cameraLimiter.limitCamera(
              this._cesiumWidget.scene.camera,
            );
          }
        });
    }
  }

  private _raisePointerInteraction(
    key: ModificationKeyType,
    pointer: number,
    pointerEvent: PointerEventType,
    csEvent:
      | ScreenSpaceEventHandler.PositionedEvent
      | ScreenSpaceEventHandler.MotionEvent,
  ): void {
    const multipleTouch =
      // eslint-disable-next-line no-underscore-dangle
      (this.screenSpaceEventHandler?._positions?.length ?? 0) > 1;
    const windowPosition = (csEvent as ScreenSpaceEventHandler.PositionedEvent)
      .position
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
  }

  private _setupInteractions(): void {
    if (!(this._cesiumWidget && this.screenSpaceEventHandler)) {
      throw new Error('Cannot setup interactions on uninitailized map');
    }
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

    this._screenSpaceListeners = types
      .map(({ pointerEvent, pointer, type }) => {
        return mods.map(({ csModifier, vcsModifier }) => {
          const handler:
            | ScreenSpaceEventHandler.PositionedEventCallback
            | ScreenSpaceEventHandler.MotionEventCallback =
            type === ScreenSpaceEventType.MOUSE_MOVE
              ? (csEvent: ScreenSpaceEventHandler.MotionEvent): void => {
                  const widget = this._cesiumWidget as CesiumWidget;
                  if (
                    widget.scene.frameState.frameNumber !==
                    this._lastEventFrameNumber
                  ) {
                    this._lastEventFrameNumber =
                      widget.scene.frameState.frameNumber;
                    this._raisePointerInteraction(
                      vcsModifier,
                      pointer,
                      pointerEvent,
                      csEvent,
                    );
                  }
                }
              : (csEvent: ScreenSpaceEventHandler.PositionedEvent): void => {
                  this._raisePointerInteraction(
                    vcsModifier,
                    pointer,
                    pointerEvent,
                    csEvent,
                  );
                };

          this.screenSpaceEventHandler?.setInputAction?.(
            handler,
            type,
            csModifier,
          );
          return () => {
            this?.screenSpaceEventHandler?.removeInputAction?.(
              type,
              csModifier,
            );
          };
        });
      })
      .flat();
  }

  initialize(): Promise<void> {
    if (!this.initialized) {
      this._cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore // error in Cesium, recheck on next cesium update
        baseLayer: false,
        shadows: false,
        terrainShadows: ShadowMode.ENABLED,
        contextOptions: {
          webgl: {
            failIfMajorPerformanceCaveat: false,
            antialias: this.webGLaa,
          },
        },
      });
      this._cesiumWidget.scene.globe.tileCacheSize = this.tileCacheSize;
      this._cesiumWidget.scene.globe.baseColor = this.globeColor;

      this.dataSourceDisplay = new DataSourceDisplay({
        scene: this._cesiumWidget.scene,
        dataSourceCollection: new DataSourceCollection(),
      });

      this._cesiumWidget.scene.frameState.creditDisplay.update = (): void => {};
      this._cesiumWidget.scene.frameState.creditDisplay.beginFrame =
        (): void => {};
      this._cesiumWidget.scene.frameState.creditDisplay.endFrame =
        (): void => {};

      const { clock } = this._cesiumWidget;
      clock.shouldAnimate = true;
      this._listeners.push(
        clock.onTick.addEventListener(() => {
          this.dataSourceDisplayClock.tick();
          const time = this.dataSourceDisplayClock.currentTime;
          this.dataSourceDisplay?.update?.(time);
        }),
      );

      // deactivate cesium Requestthrottling let the browser manage that
      // RequestScheduler.throttleRequests = false;
      RequestScheduler.maximumRequestsPerServer = 12;

      this._cesiumWidget.scene.shadowMap.maximumDistance = 5000.0;
      this._cesiumWidget.scene.shadowMap.darkness = 0.6;
      this._cesiumWidget.scene.globe.depthTestAgainstTerrain = true;
      this._cesiumWidget.scene.highDynamicRange = false;
      // this._cesiumWidget.scene.logarithmicDepthBuffer = false; // TODO observe this
      this._cesiumWidget.scene.splitPosition = this.splitPosition;

      this._cesiumWidget.scene.globe.enableLighting = this.enableLightning;

      this.setDay(this.defaultJDate);

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

      if (this._cameraLimiterOptions && !this._cameraLimiter) {
        this._cameraLimiter = new CameraLimiter(this._cameraLimiterOptions);
      }

      if (this._cameraLimiter) {
        this._setupPreUpdateListener();
      }
      this.screenSpaceEventHandler = new ScreenSpaceEventHandler(
        this._cesiumWidget.scene.canvas,
      );
      this._setupInteractions();
      this.initialized = true;

      this.defaultTerrainProvider = this._cesiumWidget.scene.terrainProvider;
      this._terrainProvider = this.defaultTerrainProvider;
      this._listeners.push(
        this._cesiumWidget.scene.terrainProviderChanged.addEventListener(
          this._terrainProviderChanged.bind(this),
        ),
      );

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
    return Promise.resolve();
  }

  async activate(): Promise<void> {
    await super.activate();
    if (this.active && this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  /**
   * getHeight for coordinates
   * @param  positions - in web mercator
   * @returns  the array of coordinates with heights updated in place
   */
  getHeightFromTerrain(positions: Coordinate[]): Promise<Coordinate[]> {
    if (!this._cesiumWidget) {
      return Promise.resolve(positions);
    }
    const { terrainProvider } = this._cesiumWidget.scene;
    if (terrainProvider.availability) {
      return getHeightFromTerrainProvider(
        terrainProvider as CesiumTerrainProvider,
        positions,
        mercatorProjection,
        positions,
      );
    }
    return Promise.resolve(positions);
  }

  getViewpoint(): Promise<null | Viewpoint> {
    return Promise.resolve(this.getViewpointSync());
  }

  getViewpointSync(): Viewpoint | null {
    if (!this._cesiumWidget || !this._cesiumWidget.scene || !this.target) {
      return null;
    }
    const cam = this._cesiumWidget.scene.camera;
    const cameraPositionCartesian = cam.position;
    let groundPosition;
    let distance;
    const ray = new Ray(cam.position, cam.direction);
    const groundPositionCartesian = this._cesiumWidget.scene.globe.pick(
      ray,
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

  async gotoViewpoint(
    viewpoint: Viewpoint,
    optMaximumHeight?: number,
  ): Promise<void> {
    if (this.movementDisabled || !viewpoint.isValid() || !this._cesiumWidget) {
      return;
    }

    let cameraPosition: Cartesian3;
    const { distance } = viewpoint;
    const heading = CesiumMath.toRadians(viewpoint.heading);
    const pitch = CesiumMath.toRadians(viewpoint.pitch);
    const roll = CesiumMath.toRadians(viewpoint.roll);
    if (viewpoint.cameraPosition) {
      const cameraCoords = viewpoint.cameraPosition;
      cameraPosition = Cartesian3.fromDegrees(
        cameraCoords[0],
        cameraCoords[1],
        cameraCoords[2],
      );
    } else {
      if (!viewpoint.groundPosition) {
        return;
      }
      const groundPositionCoords = viewpoint.groundPosition;
      if (!groundPositionCoords[2]) {
        const positions = await this.getHeightFromTerrain([
          Projection.wgs84ToMercator(groundPositionCoords),
        ]);
        groundPositionCoords[2] = positions[0][2];
      }
      const groundPosition = Cartesian3.fromDegrees(
        groundPositionCoords[0],
        groundPositionCoords[1],
        groundPositionCoords[2],
      );
      const clonedCamera = new Camera(this._cesiumWidget.scene);
      const options = {
        destination: groundPosition,
        orientation: {
          heading,
          pitch,
          roll,
        },
      };
      clonedCamera.setView(options);
      clonedCamera.moveBackward(distance);

      cameraPosition = clonedCamera.position;
    }
    const cam = this._cesiumWidget.scene.camera;
    const cameraOptions = {
      heading,
      pitch,
      roll,
    };
    cameraPosition = cameraPosition || null;
    cam.cancelFlight();
    if (viewpoint.animate) {
      await new Promise<void>((resolve) => {
        const flightOptions: Parameters<typeof Camera.prototype.flyTo>[0] = {
          destination: cameraPosition,
          orientation: cameraOptions,
          complete: (): void => {
            resolve();
          },
          cancel: (): void => {
            resolve();
          },
        };

        if (viewpoint.duration) {
          flightOptions.duration = viewpoint.duration;
        }

        if (viewpoint.easingFunction) {
          flightOptions.easingFunction = viewpoint.easingFunction;
        }

        if (optMaximumHeight) {
          flightOptions.maximumHeight = optMaximumHeight;
        }
        cam.flyTo(flightOptions);
      });
    } else {
      cam.setView({
        destination: cameraPosition,
        orientation: cameraOptions,
      });
    }
  }

  private _getCurrentResolutionFromCartesianLatitude(
    cartesian: Cartesian3,
    latitude: number,
  ): number {
    if (!this._cesiumWidget) {
      return 1;
    }
    const cam = this._cesiumWidget.scene.camera;
    const distance = Cartesian3.distance(cartesian, cam.position);

    const fov = Math.PI / 3.0;
    const width = this.mapElement.offsetWidth;
    const height = this.mapElement.offsetHeight;
    const aspectRatio = width / height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    const visibleMeters = 2 * distance * Math.tan(fovy / 2);
    const relativeCircumference = Math.cos(Math.abs(latitude));
    const visibleMapUnits = visibleMeters / relativeCircumference;

    return visibleMapUnits / height;
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
    return this._getCurrentResolutionFromCartesianLatitude(
      cartesian,
      Cartographic.fromCartesian(cartesian).latitude,
    );
  }

  disableMovement(bool: boolean): void {
    super.disableMovement(bool);
    if (this._cesiumWidget) {
      this._cesiumWidget.scene.screenSpaceCameraController.enableInputs = !bool;
    }
  }

  /**
   * set dataSource clock as display clock to visualize time dependent animation
   */
  setDataSourceDisplayClock(clock: DataSourceClock): void {
    const activeClock =
      this._dataSourceClocks[this._dataSourceClocks.length - 1];
    if (clock !== activeClock) {
      if (this._clockSyncListener) {
        this._clockSyncListener();
        this._clockSyncListener = null;
      }
      this._clockSyncListener = synchronizeClock(
        clock,
        this.dataSourceDisplayClock,
      );
    }
    this._dataSourceClocks.push(clock);
  }

  /**
   * unset dataSource clock
   */
  unsetDataSourceDisplayClock(clock: DataSourceClock): void {
    const idx = this._dataSourceClocks.lastIndexOf(clock);
    if (idx > -1) {
      this._dataSourceClocks.splice(idx, 1);
      if (idx === this._dataSourceClocks.length) {
        const activeClock =
          this._dataSourceClocks[this._dataSourceClocks.length - 1] ||
          this._defaultClock;
        if (this._clockSyncListener) {
          this._clockSyncListener();
          this._clockSyncListener = null;
        }
        this._clockSyncListener = synchronizeClock(
          activeClock,
          this.dataSourceDisplayClock,
        );
      }
    }
  }

  /**
   * sets the position of the sun according to the day
   * @param  julianDate See the Cesium API
   */
  setDay(julianDate: JulianDate): void {
    if (this._cesiumWidget) {
      this._cesiumWidget.clock.currentTime = julianDate;
      this._cesiumWidget.clock.multiplier = 1;
    }
  }

  /**
   * sets the lighting of the globe with the sun as a light source
   */
  setLightning(value: boolean): void {
    this.enableLightning = value;
    if (this._cesiumWidget) {
      this._cesiumWidget.scene.globe.enableLighting = value;
    }
  }

  /**
   * returns the cesium Widget Object
   */
  getCesiumWidget(): CesiumWidget | null {
    return this._cesiumWidget;
  }

  /**
   * returns the Entities Collection
   */
  getEntities(): EntityCollection | undefined {
    return this.dataSourceDisplay?.defaultDataSource?.entities;
  }

  /**
   * returns the dataSourceCollection associated with the scene
   */
  getDatasources(): DataSourceCollection | undefined {
    return this.dataSourceDisplay?.dataSources;
  }

  /**
   * Returns the cluster dataSourceDisplays dataSources.
   * This datasource can only handle Entities with Billboards, Labels or Points.
   */
  getClusterDatasources(): DataSourceCollection {
    if (this._clusterDataSourceDisplay) {
      return this._clusterDataSourceDisplay.dataSources;
    }

    if (!this._cesiumWidget) {
      throw new Error(
        'Cannot get Datasource collection from uninitialized map',
      );
    }
    const dataSourceCollection = new DataSourceCollection();
    const visualizersCallback = (
      _scene: Scene,
      entityCluster: EntityCluster,
      dataSource: DataSource,
    ): Visualizer[] => {
      const { entities } = dataSource;
      return [
        new BillboardVisualizer(entityCluster, entities),
        new LabelVisualizer(entityCluster, entities),
        new PointVisualizer(entityCluster, entities),
      ];
    };

    this._clusterDataSourceDisplay = new DataSourceDisplay({
      scene: this._cesiumWidget.scene,
      dataSourceCollection,
      visualizersCallback:
        visualizersCallback as unknown as DataSourceDisplay.VisualizersCallback, // XXX remove after type fix in cesium,
    });

    this._listeners.push(
      this._cesiumWidget.clock.onTick.addEventListener((clock: Clock): void => {
        this._clusterDataSourceDisplay?.update?.(clock.currentTime);
      }),
    );

    return dataSourceCollection;
  }

  indexChanged(layer: Layer): void {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach((item) => {
        if (item instanceof PrimitiveCollection) {
          indexChangedOnPrimitive(
            (this.getScene() as Scene).primitives,
            item,
            this.layerCollection,
          );
        } else if (item instanceof ImageryLayer) {
          indexChangedOnImageryLayer(
            (this.getScene() as Scene).imageryLayers,
            item,
            this.layerCollection,
          );
        } else if (item instanceof CustomDataSource) {
          indexChangedOnDataSource(
            (this.dataSourceDisplay as DataSourceDisplay).dataSources,
            item,
            this.layerCollection,
          );
        }
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
   * Internal API used to register visualizations from layer implementations
   */
  async addDataSource(dataSource: CustomDataSource): Promise<void> {
    if (!this.dataSourceDisplay) {
      throw new Error('Cannot add data source to uninitialized map');
    }
    if (this.validateVisualization(dataSource)) {
      this.addVisualization(dataSource);
      await ensureInDataSourceCollection(
        this.dataSourceDisplay.dataSources,
        dataSource,
        this.layerCollection,
      );
    }
  }

  /**
   * Internal API used to unregister visualizations from layer implementations
   */
  removeDataSource(dataSource: CustomDataSource): void {
    this.removeVisualization(dataSource);
    if (
      this.dataSourceDisplay &&
      !this.dataSourceDisplay.isDestroyed() &&
      !this.dataSourceDisplay.dataSources.isDestroyed()
    ) {
      this.dataSourceDisplay.dataSources.remove(dataSource);
    }
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
   * returns the cesium DataSourceDisplay Object
   */
  getDataSourceDisplay(): DataSourceDisplay | null {
    return this.dataSourceDisplay;
  }

  /**
   * returns the cesium Scene Object, returns null on non initialized or destroyed maps
   */
  getScene(): Scene | undefined {
    return this._cesiumWidget?.scene;
  }

  pointIsVisible(coords: Coordinate): boolean {
    if (!this._cesiumWidget) {
      return false;
    }
    const { camera } = this._cesiumWidget.scene;

    const target = Cartesian3.fromDegrees(coords[0], coords[1], 0.0);
    const cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    if (
      cullingVolume.computeVisibility(new BoundingSphere(target)) ===
      Intersect.INSIDE
    ) {
      return true;
    }
    return false;
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

  /**
   * returns true if the WEBGL Extension WEBGL_depth_texture is supported. (Is used for picking)
   */
  pickPositionSupported(): boolean {
    if (!this.initialized) {
      return false;
    }
    return this._cesiumWidget?.scene.pickPositionSupported ?? false;
  }

  /**
   * returns true if the WEBGL Extension EXT_frag_depth is supported. (Is used for GroundPoloygons)
   */
  isGroundPrimitiveSupported(): boolean {
    if (!this.initialized) {
      return false;
    }
    return this._cesiumWidget?.scene.context.fragmentDepth ?? false;
  }

  toJSON(): CesiumMapOptions {
    const config: CesiumMapOptions = super.toJSON();
    const defaultOptions = CesiumMap.getDefaultOptions();

    if (this.enableLightning !== defaultOptions.enableLightning) {
      config.enableLightning = this.enableLightning;
    }

    if (this.tileCacheSize !== defaultOptions.tileCacheSize) {
      config.tileCacheSize = this.tileCacheSize;
    }

    if (this.webGLaa !== defaultOptions.webGLaa) {
      config.webGLaa = this.webGLaa;
    }

    if (this.globeColor.toCssHexString() !== defaultOptions.globeColor) {
      config.globeColor = this.globeColor.toCssHexString();
    }

    if (this._cameraLimiter) {
      config.cameraLimiter = this._cameraLimiter.toJSON();
    } else if (this._cameraLimiterOptions && !this.initialized) {
      config.cameraLimiter = this._cameraLimiterOptions;
    }

    return config;
  }

  destroy(): void {
    if (this.dataSourceDisplay && !this.dataSourceDisplay.isDestroyed()) {
      this.dataSourceDisplay.destroy();
    }
    this._screenSpaceListeners.forEach((cb) => {
      cb();
    });
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
    this._listeners.forEach((cb) => {
      cb();
    });
    this._listeners = [];

    this._terrainProvider = null;
    this.defaultTerrainProvider = null;

    if (this._clockSyncListener) {
      this._clockSyncListener();
      this._clockSyncListener = null;
    }

    if (this._preUpdateListener) {
      this._preUpdateListener();
      this._preUpdateListener = null;
    }

    if (this._cameraLimiter) {
      this._cameraLimiter = null;
    }

    [...this.layerCollection].forEach((l) => {
      l.removedFromMap(this);
    });

    if (this._clusterDataSourceDisplay) {
      this._clusterDataSourceDisplay.destroy();
    }
    if (this._cesiumWidget) {
      this._cesiumWidget.destroy();
      this._cesiumWidget = null;
    }

    super.destroy();
  }
}

mapClassRegistry.registerClass(CesiumMap.className, CesiumMap);
export default CesiumMap;
