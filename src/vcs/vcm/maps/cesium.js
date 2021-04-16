import JulianDate from 'cesium/Source/Core/JulianDate.js';
import Clock from 'cesium/Source/Core/Clock.js';
import DataSourceClock from 'cesium/Source/DataSources/DataSourceClock.js';
import Color from 'cesium/Source/Core/Color.js';
import CesiumWidget from 'cesium/Source/Widgets/CesiumWidget/CesiumWidget.js';
import ShadowMode from 'cesium/Source/Scene/ShadowMode.js';
import DataSourceDisplay from 'cesium/Source/DataSources/DataSourceDisplay.js';
import DataSourceCollection from 'cesium/Source/DataSources/DataSourceCollection.js';
import RequestScheduler from 'cesium/Source/Core/RequestScheduler.js';
import Ellipsoid from 'cesium/Source/Core/Ellipsoid.js';
import ScreenSpaceEventHandler from 'cesium/Source/Core/ScreenSpaceEventHandler.js';
import Cartesian3 from 'cesium/Source/Core/Cartesian3.js';
import Ray from 'cesium/Source/Core/Ray.js';
import CesiumMath from 'cesium/Source/Core/Math.js';
import Camera from 'cesium/Source/Scene/Camera.js';
import BillboardVisualizer from 'cesium/Source/DataSources/BillboardVisualizer.js';
import LabelVisualizer from 'cesium/Source/DataSources/LabelVisualizer.js';
import PointVisualizer from 'cesium/Source/DataSources/PointVisualizer.js';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource.js';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere.js';
import Intersect from 'cesium/Source/Core/Intersect.js';
import CesiumInspector from 'cesium/Source/Widgets/CesiumInspector/CesiumInspector.js';
import Cesium3DTilesInspector from 'cesium/Source/Widgets/Cesium3DTilesInspector/Cesium3DTilesInspector.js';
import ImageryLayer from 'cesium/Source/Scene/ImageryLayer.js';
import PrimitiveCollection from 'cesium/Source/Scene/PrimitiveCollection.js';
import KeyboardEventModifier from 'cesium/Source/Core/KeyboardEventModifier.js';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType.js';
import Cesium3DTileset from 'cesium/Source/Scene/Cesium3DTileset.js';

import { check, checkMaybe } from '@vcsuite/check';
import { parseBoolean, parseInteger } from '@vcsuite/parsers';
import VcsMap from './map.js';
import ViewPoint from '../util/viewpoint.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import { ModificationKeyType, PointerEventType, PointerKeyType } from '../interaction/interactionType.js';
import CameraLimiter from './cameraLimiter.js';

/**
 * @typedef {vcs.vcm.maps.VcsMap.Options} vcs.vcm.maps.CesiumMap.Options
 * @property {boolean} [enableLightning=true] -  if true, lighting will be activated.
 * @property {number} [tileCacheSize=1] - the tilecache size of cesium terrain and tile layer
 * @property {boolean} [webGLaa=false] - activates webGL antialiasing (not every Browser respects this value)
 * @property {vcs.vcm.maps.CameraLimiter.Options|undefined} cameraLimiter
 * @property {string|undefined} globeColor - the color of the globe, if no image is provided
 * @api
 */

/**
 * Ensures, a primitive/imageryLayer/entity is part of a collection and placed at the correct location
 * @param {Cesium/PrimitiveCollection|Cesium/ImageryLayerCollection} cesiumCollection
 * @param {Cesium/PrimitiveCollection|Cesium/ImageryLayer|Cesium/Cesium3DTileset} item
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export function ensureInCollection(cesiumCollection, item, layerCollection) {
  const targetIndex = layerCollection.indexOfKey(item[vcsLayerName]);
  if (targetIndex > -1) {
    // @ts-ignore
    if (!cesiumCollection.contains(item)) {
      const primitivesLength = cesiumCollection.length;
      let index = primitivesLength;
      for (let i = 0; i < primitivesLength; i++) {
        const collectionItem = cesiumCollection.get(i);
        if (layerCollection.indexOfKey(collectionItem[vcsLayerName]) > targetIndex) {
          index = i;
          break;
        }
      }
      // @ts-ignore
      cesiumCollection.add(item, index);
    }
  }
}

/**
 * @param {Cesium/DataSourceCollection} dataSourceCollection
 * @param {Cesium/CustomDataSource} dataSource
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export async function ensureInDataSourceCollection(dataSourceCollection, dataSource, layerCollection) {
  const targetIndex = layerCollection.indexOfKey(dataSource[vcsLayerName]);
  if (targetIndex > -1) {
    if (!dataSourceCollection.contains(dataSource)) {
      await dataSourceCollection.add(dataSource);
    }

    const dataSourceLength = dataSourceCollection.length;
    let index = dataSourceLength;
    for (let i = 0; i < dataSourceLength; i++) {
      const collectionItem = dataSourceCollection.get(i);
      if (layerCollection.indexOfKey(collectionItem[vcsLayerName]) > targetIndex) {
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
 * @param {Cesium/PrimitiveCollection} primitiveCollection
 * @param {Cesium/PrimitiveCollection} item
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export function indexChangedOnPrimitive(primitiveCollection, item, layerCollection) {
  const { destroyPrimitives } = primitiveCollection;
  primitiveCollection.destroyPrimitives = false;
  primitiveCollection.remove(item);
  ensureInCollection(primitiveCollection, item, layerCollection);
  primitiveCollection.destroyPrimitives = destroyPrimitives;
}

/**
 * @param {Cesium/ImageryLayerCollection} imageryLayerCollection
 * @param {Cesium/ImageryLayer} item
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export function indexChangedOnImageryLayer(imageryLayerCollection, item, layerCollection) {
  imageryLayerCollection.remove(item, false);
  ensureInCollection(imageryLayerCollection, item, layerCollection);
}

/**
 * @param {Cesium/DataSourceCollection} dataSourceCollection
 * @param {Cesium/CustomDataSource} item
 * @param {vcs.vcm.util.LayerCollection} layerCollection
 */
export function indexChangedOnDataSource(dataSourceCollection, item, layerCollection) {
  ensureInDataSourceCollection(dataSourceCollection, item, layerCollection);
}

/**
 * @param {Cesium/DataSourceClock} source
 * @param {Cesium/Clock} target
 * @returns {Cesium/Event.RemoveCallback}
 */
export function synchronizeClock(source, target) {
  target.clockRange = source.clockRange;
  target.clockStep = source.clockStep;
  target.multiplier = source.multiplier;
  if (!target.startTime || !target.startTime.equals(source.startTime) ||
    !target.stopTime || !target.stopTime.equals(source.stopTime)) {
    target.startTime = source.startTime;
    target.stopTime = source.stopTime;
    target.currentTime = source.currentTime;
  }
  return source.definitionChanged.addEventListener((e, prop, value) => {
    target[prop] = value;
  });
}

/**
 * @param {Cesium/Cesium3DTileset} cesium3DTileset
 * @param {boolean} debug
 */
function setDebugOnCesium3DTileset(cesium3DTileset, debug) {
  cesium3DTileset.debugShowRenderingStatistics = debug;
  cesium3DTileset.debugShowBoundingVolume = debug;
  cesium3DTileset.debugShowContentBoundingVolume = debug;
}

/**
 * @param {Array<Cesium/PrimitiveCollection|Cesium/Cesium3DTileset|Cesium/ImageryLayer|ol/layer/Layer|Cesium/CustomDataSource>} visualizations
 * @param {boolean} debug
 */
function setDebugOnVisualizations(visualizations, debug) {
  visualizations
    .filter(viz => viz instanceof Cesium3DTileset)
    .forEach(/** @param {Cesium/Cesium3DTileset} tileset */ (tileset) => {
      setDebugOnCesium3DTileset(tileset, debug);
    });
}

/**
 * Cesium Globe Map Class (3D map)
 * @class
 * @export
 * @extends {vcs.vcm.maps.VcsMap}
 * @api stable
 * @memberOf vcs.vcm.maps
 */
class CesiumMap extends VcsMap {
  static get className() { return 'vcs.vcm.maps.Cesium'; }

  /**
   * @returns {vcs.vcm.maps.CesiumMap.Options}
   */
  static getDefaultOptions() {
    return {
      ...VcsMap.getDefaultOptions(),
      enableLightning: true,
      tileCacheSize: 1,
      webGLaa: false,
      cameraLimiter: undefined,
      globeColor: '#3f47cc',
    };
  }

  /**
   * @param {vcs.vcm.maps.CesiumMap.Options} options
   */
  constructor(options) {
    super(options);

    const defaultOptions = CesiumMap.getDefaultOptions();
    /**
     * the Cesium Viewer
     * @type {?Cesium/CesiumWidget}
     * @private
     */
    this._cesiumWidget = null;

    /**
     * clock for animated data
     * @type {Cesium/Clock}
     */
    this.dataSourceDisplayClock = new Clock({ shouldAnimate: true });

    const defaultClock = new DataSourceClock();
    defaultClock.currentTime = this.dataSourceDisplayClock.currentTime;
    /**
     * default clock is set, when no datasource clock is active
     * @type {Cesium/DataSourceClock}
     * @private
     */
    this._defaultClock = defaultClock;

    /**
     * clocks of active data sources
     * the last clock of the array corresponds to the active dataSourceDisplayClock
     * @type {Array<Cesium/DataSourceClock>}
     * @private
     */
    this._dataSourceClocks = [];

    /**
     * Whether the debug mode is active or not
     * @type {boolean}
     * @api stable
     */
    this.debugMode = false;

    /** @type {boolean} */
    this.enableLightning = parseBoolean(options.enableLightning, defaultOptions.enableLightning);

    /** @type {number} */
    this.tileCacheSize = parseInteger(options.tileCacheSize, defaultOptions.tileCacheSize);

    /** @type {Cesium/ScreenSpaceEventHandler} */
    this.screenSpaceEventHandler = null;
    /**
     * @type {Array<function():void>}
     * @private
     */
    this._screenSpaceListeners = [];

    /**
     * @type {Cesium/JulianDate}
     */
    this.defaultJDate = JulianDate.fromDate(new Date(2014, 6, 20, 13, 0, 0, 0));

    /** @type {boolean} */
    this.webGLaa = parseBoolean(options.webGLaa, defaultOptions.webGLaa);

    /**
     * @type {Cesium/Color}
     * @api
     */
    this.globeColor = Color.fromCssColorString(options.globeColor || defaultOptions.globeColor);

    /** @type {Cesium/DataSourceDisplay|null} */
    this._clusterDataSourceDisplay = null;

    /**
     * @type {Cesium/TerrainProvider}
     * @private
     */
    this._terrainProvider = null;

    /**
     * @type {Cesium/TerrainProvider}
     * @api
     */
    this.defaultTerrainProvider = null;
    /**
     * @type {vcs.vcm.maps.CameraLimiter|null}
     * @private
     */
    this._cameraLimiter = null;
    /**
     * @type {vcs.vcm.maps.CameraLimiter.Options}
     * @private
     */
    this._cameraLimiterOptions = options.cameraLimiter || defaultOptions.cameraLimiter;
    /**
     * @type {Function}
     * @private
     */
    this._terrainProviderChangedListener = null;
    /**
     * @type {Function}
     * @private
     */
    this._preUpdateListener = null;
    /**
     * @type {Function}
     * @private
     */
    this._clockTickListener = null;
    /**
     * @type {Function}
     * @private
     */
    this._clockSyncListener = null;

    /**
     * @type {Function}
     * @private
     */
    this._removeClusterClockTickListener = null;

    /**
     * @type {boolean}
     * @private
     */
    this._debug = false;
  }

  /**
   * @returns {Cesium/TerrainProvider}
   * @api
   * @readonly
   */
  get terrainProvider() {
    return this._terrainProvider;
  }

  /**
   * A camera limit to not allow the camera to get too close to the globe.
   * @type {vcs.vcm.maps.CameraLimiter|null}
   * @api
   */
  get cameraLimiter() {
    return this._cameraLimiter;
  }

  /**
   * @param {vcs.vcm.maps.CameraLimiter|null} limiter
   */
  set cameraLimiter(limiter) {
    checkMaybe(limiter, CameraLimiter);

    if (this._cameraLimiter !== limiter) {
      this._cameraLimiter = limiter;
      if (this._cameraLimiter && !this._preUpdateListener && this._cesiumWidget) {
        this._setupPreUpdateListener();
      } else if (!this._cameraLimiter && this._preUpdateListener) {
        this._preUpdateListener();
        this._preUpdateListener = null;
      }
    }
  }

  /**
   * Show the CesiumInspector and the Cesium3DTileInspector. In addition show the bounding volume on all Cesium3DTilesets
   * plus their rendering statistics.
   * @type {boolean}
   * @api
   */
  get debug() {
    return this._debug;
  }

  /**
   * @param {boolean} debug
   */
  set debug(debug) {
    check(debug, Boolean);

    if (this._debug !== debug) {
      this._debug = debug;
      if (this.initialized) {
        this._setDebug();
      }
    }
  }

  /**
   * @private
   */
  _setupPreUpdateListener() {
    this._preUpdateListener = this._cesiumWidget.scene.preUpdate.addEventListener(() => {
      if (this._cameraLimiter) {
        this._cameraLimiter.limitCamera(this._cesiumWidget.scene.camera);
      }
    });
  }

  /**
   * @param {vcs.vcm.interaction.ModificationKeyType} key
   * @param {number} pointer
   * @param {vcs.vcm.interaction.PointerEventType} pointerEvent
   * @param {{ position: (Cesium/Cartesian2|undefined), endPosition: (Cesium/Cartesian2|undefined) }} csEvent
   * @private
   */
  _raisePointerInteraction(key, pointer, pointerEvent, csEvent) {
    // eslint-disable-next-line
    const multipleTouch = this.screenSpaceEventHandler._positions.length > 1;
    this.pointerInteractionEvent.raiseEvent({
      map: this,
      windowPosition: csEvent.position || csEvent.endPosition,
      key,
      pointer,
      multipleTouch,
      pointerEvent,
    });
  }

  /**
   * @private
   */
  _setupInteractions() {
    const mods = [
      { csModifier: KeyboardEventModifier.ALT, vcsModifier: ModificationKeyType.ALT },
      { csModifier: KeyboardEventModifier.CTRL, vcsModifier: ModificationKeyType.CTRL },
      { csModifier: KeyboardEventModifier.SHIFT, vcsModifier: ModificationKeyType.SHIFT },
      { csModifier: undefined, vcsModifier: ModificationKeyType.NONE },
    ];

    const types = [
      { type: ScreenSpaceEventType.LEFT_DOWN, pointerEvent: PointerEventType.DOWN, pointer: PointerKeyType.LEFT },
      { type: ScreenSpaceEventType.LEFT_UP, pointerEvent: PointerEventType.UP, pointer: PointerKeyType.LEFT },
      { type: ScreenSpaceEventType.RIGHT_DOWN, pointerEvent: PointerEventType.DOWN, pointer: PointerKeyType.RIGHT },
      { type: ScreenSpaceEventType.RIGHT_UP, pointerEvent: PointerEventType.UP, pointer: PointerKeyType.RIGHT },
      { type: ScreenSpaceEventType.MIDDLE_DOWN, pointerEvent: PointerEventType.DOWN, pointer: PointerKeyType.MIDDLE },
      { type: ScreenSpaceEventType.MIDDLE_UP, pointerEvent: PointerEventType.UP, pointer: PointerKeyType.MIDDLE },
      { type: ScreenSpaceEventType.MOUSE_MOVE, pointerEvent: PointerEventType.MOVE, pointer: PointerKeyType.ALL },
    ];

    this._screenSpaceListeners = types.map(({ pointerEvent, pointer, type }) => {
      return mods.map(({ csModifier, vcsModifier }) => {
        this.screenSpaceEventHandler.setInputAction((csEvent) => {
          this._raisePointerInteraction(vcsModifier, pointer, pointerEvent, csEvent);
        }, type, csModifier);
        return () => { this.screenSpaceEventHandler.removeInputAction(type, csModifier); };
      });
    }).flat();
  }

  /**
   * initializes the map
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      this._cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        imageryProvider: false,
        shadows: false,
        terrainShadows: ShadowMode.ENABLED,
        contextOptions: { webgl: { failIfMajorPerformanceCaveat: false, antialias: this.webGLaa } },
      });
      this._cesiumWidget.scene.globe.tileCacheSize = this.tileCacheSize;
      this._cesiumWidget.scene.globe.baseColor = this.globeColor;

      /** @type {Cesium/DataSourceDisplay} */
      this.dataSourceDisplay = new DataSourceDisplay({
        scene: this._cesiumWidget.scene,
        dataSourceCollection: new DataSourceCollection(),
      });

      this._cesiumWidget.scene.frameState.creditDisplay.update = () => {};
      this._cesiumWidget.scene.frameState.creditDisplay.beginFrame = () => {};
      this._cesiumWidget.scene.frameState.creditDisplay.endFrame = () => {};

      const { clock } = this._cesiumWidget;
      clock.shouldAnimate = true;
      this._clockTickListener = clock.onTick.addEventListener(() => {
        this.dataSourceDisplayClock.tick();
        const time = this.dataSourceDisplayClock.currentTime;
        this.dataSourceDisplay.update(time);
      });

      // deactivate cesium Requestthrottling let the browser manage that
      // RequestScheduler.throttleRequests = false;
      RequestScheduler.maximumRequestsPerServer = 12;

      this._cesiumWidget.scene.shadowMap.maximumDistance = 5000.0;
      this._cesiumWidget.scene.shadowMap.darkness = 0.6;
      this._cesiumWidget.scene.globe.depthTestAgainstTerrain = true;
      this._cesiumWidget.scene.highDynamicRange = false;
      // this._cesiumWidget.scene.logarithmicDepthBuffer = false; // TODO observe this
      this._cesiumWidget.scene.imagerySplitPosition = 0.5;

      this._cesiumWidget.scene.globe.enableLighting = this.enableLightning;

      this.setDay(this.defaultJDate);

      // hide default cesium credits container
      const creditsContainer = document.getElementsByClassName('cesium-widget-credits');
      if (creditsContainer) {
        for (let i = 0; i < creditsContainer.length; i++) {
          const element = /** @type {HTMLElement} */ (creditsContainer[i]);
          element.style.display = 'none';
        }
      }

      if (this._cameraLimiterOptions && !this._cameraLimiter) {
        this._cameraLimiter = new CameraLimiter(this._cameraLimiterOptions);
      }

      if (this._cameraLimiter) {
        this._setupPreUpdateListener();
      }
      this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this._cesiumWidget.scene.canvas);
      this._setupInteractions();
      this.initialized = true;

      this.defaultTerrainProvider = this._cesiumWidget.scene.terrainProvider;
      this._terrainProvider = this.defaultTerrainProvider;
      this._terrainProviderChangedListener =
        this._cesiumWidget.scene.terrainProviderChanged.addEventListener(this._terrainProviderChanged.bind(this));
      if (this._debug) {
        this._setDebug();
      }
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async activate() {
    await super.activate();
    if (this.active) {
      this._cesiumWidget.useDefaultRenderLoop = true;
      this._cesiumWidget.resize();
    }
  }

  /**
   * @inheritDoc
   */
  deactivate() {
    super.deactivate();
    if (this._cesiumWidget) {
      this._cesiumWidget.useDefaultRenderLoop = false;
    }
  }

  /**
   * getHeight for coordinates
   * @param {Array<ol/Coordinate>} positions - in web mercator
   * @returns {Promise<Array<ol/Coordinate>>} the array of coordinates with heights updated in place
   * @api stable
   */
  getHeightFromTerrain(positions) {
    const { terrainProvider } = this._cesiumWidget.scene;
    return terrainProvider.readyPromise.then(() => {
      if (terrainProvider.availability) {
        return getHeightFromTerrainProvider(
          /** @type {Cesium/CesiumTerrainProvider} */(terrainProvider),
          positions,
          mercatorProjection,
        );
      }
      return Promise.resolve(positions);
    });
  }

  /**
   * @inheritDoc
   * @returns {Promise<null|vcs.vcm.util.ViewPoint>}
   */
  async getViewPoint() {
    return this.getViewPointSync();
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.util.ViewPoint|null}
   */
  getViewPointSync() {
    if (!this._cesiumWidget || !this._cesiumWidget.scene || !this.target) {
      return null;
    }
    const cam = this._cesiumWidget.scene.camera;
    const cameraPositionCartesian = cam.position;
    let groundPosition = null;
    let distance = null;
    const ray = new Ray(cam.position, cam.direction);
    const groundPositionCartesian = this._cesiumWidget.scene.globe.pick(ray, this._cesiumWidget.scene);
    if (groundPositionCartesian) {
      distance = Cartesian3.distance(groundPositionCartesian, cameraPositionCartesian);
      const groundPositionCartographic = Ellipsoid.WGS84.cartesianToCartographic(groundPositionCartesian);
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
    return new ViewPoint({
      groundPosition,
      cameraPosition,
      distance,
      heading: CesiumMath.toDegrees(cam.heading),
      pitch: CesiumMath.toDegrees(cam.pitch),
      roll: CesiumMath.toDegrees(cam.roll),
    });
  }

  /**
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @param {number=} optMaximumHeight
   * @returns {Promise<void>}
   * @inheritDoc
   */
  async gotoViewPoint(viewpoint, optMaximumHeight) {
    if (this.movementDisabled || !viewpoint.isValid()) {
      return;
    }

    let cameraPosition = null;
    const { distance } = viewpoint;
    const heading = CesiumMath.toRadians(viewpoint.heading);
    const pitch = CesiumMath.toRadians(viewpoint.pitch);
    const roll = CesiumMath.toRadians(viewpoint.roll);
    if (viewpoint.cameraPosition) {
      const cameraCoords = viewpoint.cameraPosition;
      cameraPosition = Cartesian3.fromDegrees(cameraCoords[0], cameraCoords[1], cameraCoords[2]);
    } else {
      if (!viewpoint.groundPosition) {
        return;
      }
      const groundPositionCoords = viewpoint.groundPosition;
      if (!groundPositionCoords[2]) {
        const positions = await this.getHeightFromTerrain([Projection.wgs84ToMercator(groundPositionCoords)]);
        groundPositionCoords[2] = positions[0][2];
      }
      const groundPosition = Cartesian3.fromDegrees(
        groundPositionCoords[0], groundPositionCoords[1], groundPositionCoords[2],
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
    if (viewpoint.animate) {
      await new Promise((resolve) => {
        const flightOptions = {
          destination: cameraPosition,
          orientation: cameraOptions,
          complete: resolve,
          cancel: resolve,
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

  /**
   * @inheritDoc
   * @param {ol/Coordinate} coordinate - in mercator
   * @returns {number}
   */
  getCurrentResolution(coordinate) {
    const cam = this._cesiumWidget.scene.camera;
    const wgs84Coordinate = Projection.mercatorToWgs84(coordinate);
    const distance = Cartesian3
      .distance(Cartesian3.fromDegrees(wgs84Coordinate[0], wgs84Coordinate[1], wgs84Coordinate[2]), cam.position);

    const fov = Math.PI / 3.0;
    const width = this.mapElement.offsetWidth;
    const height = this.mapElement.offsetHeight;
    const aspectRatio = width / height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    const visibleMeters = 2 * distance * Math.tan(fovy / 2);
    const relativeCircumference = Math.cos(Math.abs(CesiumMath.toRadians(wgs84Coordinate[1])));
    const visibleMapUnits = visibleMeters / relativeCircumference;

    return visibleMapUnits / height;
  }

  /**
   * @param {boolean} bool
   * @inheritDoc
   */
  disableMovement(bool) {
    super.disableMovement(bool);
    this._cesiumWidget.scene.screenSpaceCameraController.enableInputs = !bool;
  }

  /**
   * set dataSource clock as display clock to visualize time dependent animation
   * @param {Cesium/DataSourceClock} clock
   * @api stable
   */
  setDataSourceDisplayClock(clock) {
    const activeClock = this._dataSourceClocks[this._dataSourceClocks.length - 1];
    if (clock !== activeClock) {
      if (this._clockSyncListener) {
        this._clockSyncListener();
        this._clockSyncListener = null;
      }
      this._clockSyncListener = synchronizeClock(clock, this.dataSourceDisplayClock);
    }
    this._dataSourceClocks.push(clock);
  }

  /**
   * unset dataSource clock
   * @param {Cesium/DataSourceClock} clock
   * @api stable
   */
  unsetDataSourceDisplayClock(clock) {
    const idx = this._dataSourceClocks.lastIndexOf(clock);
    if (idx > -1) {
      this._dataSourceClocks.splice(idx, 1);
      if (idx === this._dataSourceClocks.length) {
        const activeClock = this._dataSourceClocks[this._dataSourceClocks.length - 1] || this._defaultClock;
        if (this._clockSyncListener) {
          this._clockSyncListener();
          this._clockSyncListener = null;
        }
        this._clockSyncListener = synchronizeClock(activeClock, this.dataSourceDisplayClock);
      }
    }
  }

  /**
   * sets the position of the sun according to the day
   * @param {Cesium/JulianDate} julianDate See the Cesium API
   * @api stable
   */
  setDay(julianDate) {
    this._cesiumWidget.clock.currentTime = julianDate;
    this._cesiumWidget.clock.multiplier = 1;
  }

  /**
   * sets the lighting of the globe with the sun as a light source
   * @param {boolean} value
   * @api stable
   */
  setLightning(value) {
    this.enableLightning = value;
    this._cesiumWidget.scene.globe.enableLighting = value;
  }

  /**
   * returns the cesium Widget Object
   * @returns {Cesium/CesiumWidget}
   * @api stable
   */
  getCesiumWidget() {
    return this._cesiumWidget;
  }

  /**
   * returns the Entities Collection
   * @returns {Cesium/EntityCollection}
   * @api stable
   */
  getEntities() {
    return this.dataSourceDisplay.defaultDataSource.entities;
  }

  /**
   * returns the dataSourceCollection associated with the scene
   * @returns {Cesium/DataSourceCollection}
   * @api stable
   */
  getDatasources() {
    return this.dataSourceDisplay.dataSources;
  }

  /**
   * Returns the cluster dataSourceDisplays dataSources.
   * This datasource can only handle Entities with Billboards, Labels or Points.
   * @returns {Cesium/DataSourceCollection}
   * @api stable
   */
  getClusterDatasources() {
    if (this._clusterDataSourceDisplay) {
      return this._clusterDataSourceDisplay.dataSources;
    }

    const dataSourceCollection = new DataSourceCollection();
    function visualizersCallback(scene, entityCluster, dataSource) {
      const { entities } = dataSource;
      return [new BillboardVisualizer(entityCluster, entities),
        new LabelVisualizer(entityCluster, entities),
        new PointVisualizer(entityCluster, entities),
      ];
    }

    this._clusterDataSourceDisplay = new DataSourceDisplay({
      scene: this._cesiumWidget.scene,
      dataSourceCollection,
      visualizersCallback,
    });

    this._removeClusterClockTickListener =
      this._cesiumWidget.clock.onTick.addEventListener((clock) => {
        this._clusterDataSourceDisplay.update(clock.currentTime);
      });

    return dataSourceCollection;
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.layer.Layer} layer
   */
  indexChanged(layer) {
    const viz = this.getVisualizationsForLayer(layer);
    if (viz) {
      viz.forEach((item) => {
        if (item instanceof PrimitiveCollection) {
          indexChangedOnPrimitive(this.getScene().primitives, item, this.layerCollection);
        } else if (item instanceof ImageryLayer) {
          indexChangedOnImageryLayer(this.getScene().imageryLayers, item, this.layerCollection);
        } else if (item instanceof CustomDataSource) {
          indexChangedOnDataSource(this.dataSourceDisplay.dataSources, item, this.layerCollection);
        }
      });
    }
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param {Cesium/PrimitiveCollection|Cesium/Cesium3DTileset} primitiveCollection
   */
  addPrimitiveCollection(primitiveCollection) {
    if (this.validateVisualization(primitiveCollection)) {
      this.addVisualization(primitiveCollection);
      if (this._debug && primitiveCollection instanceof Cesium3DTileset) {
        setDebugOnCesium3DTileset(primitiveCollection, this._debug);
      }
      ensureInCollection(this.getScene().primitives, primitiveCollection, this.layerCollection);
    }
  }

  /**
   * Internal API to unregister the visualization for a layers implementation
   * @param {Cesium/PrimitiveCollection} primitiveCollection
   */
  removePrimitiveCollection(primitiveCollection) { // XXX add destroy as boolean?
    this.removeVisualization(primitiveCollection);
    this.getScene().primitives.remove(primitiveCollection);
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param {Cesium/ImageryLayer} imageryLayer
   */
  addImageryLayer(imageryLayer) {
    if (this.validateVisualization(imageryLayer)) {
      this.addVisualization(imageryLayer);
      ensureInCollection(this.getScene().imageryLayers, imageryLayer, this.layerCollection);
    }
  }

  /**
   * Internal API used to unregister visualizations from layer implementations
   * @param {Cesium/ImageryLayer} imageryLayer
   */
  removeImageryLayer(imageryLayer) {
    this.removeVisualization(imageryLayer);
    this.getScene().imageryLayers.remove(imageryLayer);
  }

  /**
   * Internal API used to register visualizations from layer implementations
   * @param {Cesium/CustomDataSource} dataSource
   * @returns {Promise<void>}
   */
  async addDataSource(dataSource) {
    if (this.validateVisualization(dataSource)) {
      this.addVisualization(dataSource);
      await ensureInDataSourceCollection(this.dataSourceDisplay.dataSources, dataSource, this.layerCollection);
    }
  }

  /**
   * Internal API used to unregister visualizations from layer implementations
   * @param {Cesium/CustomDataSource} dataSource
   */
  removeDataSource(dataSource) {
    this.removeVisualization(dataSource);
    this.dataSourceDisplay.dataSources.remove(dataSource);
  }

  /**
   * set the cesium TerrainProvider
   * @param {Cesium/TerrainProvider} terrainProvider
   * @api
   */
  setTerrainProvider(terrainProvider) {
    if (this.terrainProvider !== terrainProvider) {
      this._cesiumWidget.scene.terrainProvider = terrainProvider;
    }
  }

  /**
   * unsets the TerrainProvider (changes to the default TerrainProvider if the given terranProvider is currently active)
   * @param {Cesium/TerrainProvider} terrainProvider
   * @api
   */
  unsetTerrainProvider(terrainProvider) {
    if (this.terrainProvider === terrainProvider) {
      this._terrainProvider = this.defaultTerrainProvider;
      this._cesiumWidget.scene.terrainProvider = this.defaultTerrainProvider;
    }
  }

  /**
   * returns the cesium DataSourceDisplay Object
   * @returns {Cesium/DataSourceDisplay}
   * @api stable
   */
  getDataSourceDisplay() {
    return this.dataSourceDisplay;
  }

  /**
   * returns the cesium Viewer Object
   * @returns {Cesium/Scene}
   * @api stable
   */
  getScene() {
    return this._cesiumWidget.scene;
  }

  /**
   * @returns {Cesium/CesiumWidget|*}
   * @deprecated 3.7
   */
  getViewer() {
    this.getLogger().deprecate('getViewer', 'use getCesiumWidget instead.');
    return this._cesiumWidget;
  }

  /**
   * @param {ol/Coordinate} coords in WGS84 degrees
   * @returns {boolean}
   * @api
   */
  pointIsVisible(coords) {
    const { camera } = this._cesiumWidget.scene;

    const target = Cartesian3.fromDegrees(coords[0], coords[1], 0.0);
    const cullingVolume = camera.frustum.computeCullingVolume(camera.positionWC, camera.directionWC, camera.upWC);
    if (cullingVolume.computeVisibility(new BoundingSphere(target)) === Intersect.INSIDE) {
      return true;
    }
    return false;
  }

  // TODO cesium map requestRender
  /**
   * sets the Cesium debug mode.
   * @api stable
   * @deprecated v4.1
   */
  setDebugMode() {
    this.getLogger().deprecate('setDebugMode', 'set the debug property directly');
    this.debug = true;
  }

  /**
   * @private
   */
  _setDebug() {
    if (this._debug && this.initialized && !this._cesiumInspectorContainer) {
      this._cesiumInspectorContainer = document.createElement('div');
      this._cesiumInspectorContainer.className = 'vcm-cesium-inspector';
      this.mapElement.appendChild(this._cesiumInspectorContainer);
      this._cesiumInspector = new CesiumInspector(this._cesiumInspectorContainer, this.getScene());
      this._cesium3DTilesInspector = new Cesium3DTilesInspector(this._cesiumInspectorContainer, this.getScene());
      this._cesium3DTilesInspector.viewModel.picking = false;
    }

    if (this._cesiumInspectorContainer) {
      this._cesiumInspectorContainer.style.display = this.active && this._debug ? '' : 'none';
    }
    setDebugOnVisualizations(this.getVisualizations(), this._debug);
  }

  /**
   * is called when the cesium Terrainprovider changes. Sets the .terrainProvider and deactivates currently
   * active Terrain layer if necessary
   * @param {Cesium/TerrainProvider} terrainProvider
   * @private
   */
  _terrainProviderChanged(terrainProvider) {
    if (this.terrainProvider !== terrainProvider) {
      const layer = this.layerCollection.getByKey(this.terrainProvider[vcsLayerName]);
      this._terrainProvider = terrainProvider;
      if (layer) {
        layer.deactivate();
      }
    }
  }

  /**
   * returns true if the WEBGL Extension WEBGL_depth_texture is supported. (Is used for picking)
   * @returns {*}
   */
  pickPositionSupported() {
    if (!this.initialized) {
      return false;
    }
    return this._cesiumWidget.scene.pickPositionSupported;
  }

  /**
   * returns true if the WEBGL Extension EXT_frag_depth is supported. (Is used for GroundPoloygons)
   * @returns {*}
   */
  isGroundPrimitiveSupported() {
    if (!this.initialized) {
      return false;
    }
    return this._cesiumWidget.scene.context.fragmentDepth;
  }

  /**
   * @returns {vcs.vcm.maps.CesiumMap.Options}
   * @api
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.maps.CesiumMap.Options} */ (super.getConfigObject());
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
      config.cameraLimiter = this._cameraLimiter.getConfigObject();
    } else if (this._cameraLimiterOptions && !this.initialized) {
      config.cameraLimiter = this._cameraLimiterOptions;
    }

    return config;
  }

  /**
   * @api
   */
  destroy() {
    if (this.dataSourceDisplay && !this.dataSourceDisplay.isDestroyed()) {
      this.dataSourceDisplay.destroy();
    }
    this._screenSpaceListeners.forEach((cb) => { cb(); });
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
    if (this._terrainProviderChangedListener) {
      this._terrainProviderChangedListener();
      this._terrainProviderChangedListener = null;
    }
    this._terrainProvider = null;
    this.defaultTerrainProvider = null;

    if (this._clockTickListener) {
      this._clockTickListener();
      this._clockTickListener = null;
    }

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
    if (this._removeClusterClockTickListener) {
      this._removeClusterClockTickListener();
    }
    if (this._clusterDataSourceDisplay) {
      this._clusterDataSourceDisplay.destroy();
    }
    if (this._cesiumWidget) {
      this._cesiumWidget.destroy();
      this._cesiumWidget = null;
    }
    if (this._cesium3DTilesInspector) {
      this._cesium3DTilesInspector.destroy();
      this._cesium3DTilesInspector = null;
    }
    if (this._cesiumInspector) {
      this._cesiumInspector.destroy();
      this._cesiumInspector = null;
    }
    if (this._cesiumInspectorContainer) {
      this._cesiumInspectorContainer.parentElement.removeChild(this._cesiumInspectorContainer);
      this._cesiumInspectorContainer = null;
    }
    super.destroy();
  }
}

export default CesiumMap;
