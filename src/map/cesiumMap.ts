import {
  BillboardVisualizer,
  BoundingSphere,
  Camera,
  Cartesian3,
  type CesiumTerrainProvider,
  CesiumWidget,
  Clock,
  Color,
  type ContextOptions,
  CustomDataSource,
  type DataSource,
  DataSourceClock,
  DataSourceCollection,
  DataSourceDisplay,
  type EntityCluster,
  type EntityCollection,
  type Event as CesiumEvent,
  Intersect,
  JulianDate,
  LabelVisualizer,
  Math as CesiumMath,
  PointVisualizer,
  type Scene,
  type ShadowMap,
  ShadowMode,
  type Visualizer,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import { check, maybe } from '@vcsuite/check';
import { parseBoolean, parseInteger, parseNumber } from '@vcsuite/parsers';
import VcsMap, { type VcsMapOptions } from './vcsMap.js';
import type Viewpoint from '../util/viewpoint.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import type { CameraLimiterOptions } from './cameraLimiter.js';
import CameraLimiter from './cameraLimiter.js';
import { mapClassRegistry } from '../classRegistry.js';
import type LayerCollection from '../util/layerCollection.js';
import VcsEvent from '../vcsEvent.js';
import type { DisableMapControlOptions } from '../util/mapCollection.js';
import { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';
import BaseCesiumMap, {
  type CesiumVisualisationType,
} from './baseCesiumMap.js';

/**
 * @param  dataSourceCollection
 * @param  dataSource
 * @param  layerCollection
 * @private
 */
async function ensureInDataSourceCollection(
  dataSourceCollection: DataSourceCollection,
  dataSource: CustomDataSource,
  layerCollection: LayerCollection,
): Promise<void> {
  let targetIndex = -1;
  if (dataSource[vectorClusterGroupName]) {
    targetIndex = layerCollection.size;
  } else {
    targetIndex = layerCollection.indexOfKey(
      dataSource[vcsLayerName],
    ) as number;
  }

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
 * @param  dataSourceCollection
 * @param  item
 * @param  layerCollection
 * @private
 */
function indexChangedOnDataSource(
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

  /**
   * use Original Cesium Shader, otherwise the VCS Customized Shader will be used.
   * This is a global Setting for all VCMap Instances on the same page.
   */
  useOriginalCesiumShader?: boolean;

  /**
   * changes the default Cesium Sunlight Intensity (default is 3.0)
   * Cesium Default is 2.0
   */
  lightIntensity?: number;

  /**
   * can be used to forward contextOptions to the CesiumWidget
   * https://cesium.com/learn/cesiumjs/ref-doc/global.html#ContextOptions
   */
  contextOptions?: ContextOptions;
};

export type CesiumMapEvent = {
  scene: Scene;
  time: JulianDate;
};

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

/**
 * Cesium Globe Map Class (3D map)
 * @group Map
 */
class CesiumMap extends BaseCesiumMap {
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
      useOriginalCesiumShader: false,
      lightIntensity: 3.0,
      contextOptions: undefined,
    };
  }

  dataSourceDisplay: DataSourceDisplay | null = null;

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
  private _dataSourceClocks: DataSourceClock[] = [];

  enableLightning: boolean;

  tileCacheSize: number;

  defaultJDate: JulianDate;

  /**
   * The defaultShadowMap which is created when calling the constructor of the CesiumWidet in {@link initialize}. This is a reference, not a clone.
   */
  private _defaultShadowMap: ShadowMap | null = null;

  /**
   * A cache of the shadowMap that is set, before {@link initialize} is called. It is applied as soon the instance is initialized.
   */
  private _initialShadowMap: ShadowMap | undefined;

  shadowMapChanged = new VcsEvent<ShadowMap>();

  webGLaa: boolean;

  globeColor: Color;

  private _clusterDataSourceDisplay: DataSourceDisplay | undefined;

  useOriginalCesiumShader: boolean;

  private _cameraLimiter: CameraLimiter | null = null;

  private _cameraLimiterOptions: CameraLimiterOptions | undefined;

  private _preUpdateListener: (() => void) | undefined;

  private _clockSyncListener: (() => void) | undefined;

  private _lightIntensity: number;

  private _contextOptions: ContextOptions | undefined;

  constructor(options: CesiumMapOptions) {
    const defaultOptions = CesiumMap.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.dataSourceDisplayClock = new Clock({ shouldAnimate: true });

    const defaultClock = new DataSourceClock();
    defaultClock.currentTime = this.dataSourceDisplayClock.currentTime;
    this._defaultClock = defaultClock;

    this.enableLightning = parseBoolean(
      options.enableLightning,
      defaultOptions.enableLightning,
    );

    this.tileCacheSize = parseInteger(
      options.tileCacheSize,
      defaultOptions.tileCacheSize,
    );

    this.defaultJDate = JulianDate.fromDate(new Date(2014, 6, 20, 13, 0, 0, 0));

    this.webGLaa = parseBoolean(options.webGLaa, defaultOptions.webGLaa);

    this.useOriginalCesiumShader = parseBoolean(
      options.useOriginalCesiumShader,
      defaultOptions.useOriginalCesiumShader,
    );

    this.globeColor = Color.fromCssColorString(
      options.globeColor || (defaultOptions.globeColor as string),
    );

    this._cameraLimiterOptions =
      options.cameraLimiter || defaultOptions.cameraLimiter;

    this._lightIntensity = parseNumber(
      options.lightIntensity,
      defaultOptions.lightIntensity,
    );

    this._contextOptions = structuredClone(options.contextOptions);
  }

  /**
   * returns the light Intensity, see Cesium https://cesium.com/learn/cesiumjs/ref-doc/SunLight.html?classFilter=sunlight#intensity
   */
  get lightIntensity(): number {
    return this._lightIntensity;
  }

  /**
   * sets the light Intensity, see Cesium https://cesium.com/learn/cesiumjs/ref-doc/SunLight.html?classFilter=sunlight#intensity
   */
  set lightIntensity(intensity: number) {
    this._lightIntensity = intensity;
    if (this.initialized && this._cesiumWidget) {
      this._cesiumWidget.scene.light.intensity = intensity;
    }
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

  get defaultShadowMap(): ShadowMap | null {
    return this._defaultShadowMap;
  }

  /**
   * A camera limit to not allow the camera to get too close to the globe.
   */
  get cameraLimiter(): CameraLimiter | null {
    return this._cameraLimiter;
  }

  set cameraLimiter(limiter: CameraLimiter | null) {
    check(limiter, maybe(CameraLimiter));

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
        this._preUpdateListener = undefined;
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

  initialize(): Promise<void> {
    if (!this.initialized) {
      if (!this.useOriginalCesiumShader) {
        globalThis.useVcsCustomShading = true;
      } else if (globalThis.useVcsCustomShading) {
        this.getLogger().error(
          'Cannot activate Original Cesium Shader, flag to use VCS Shader is already set by another Cesium Map or VCMap Instance',
        );
      }

      const contextOptions = {
        ...this._contextOptions,
        webgl: {
          ...this._contextOptions?.webgl,
          antialias: this.webGLaa,
        },
      };

      const cesiumWidget = new CesiumWidget(this.mapElement, {
        requestRenderMode: false,
        scene3DOnly: true,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore // error in Cesium, recheck on next cesium update
        baseLayer: false,
        shadows: false,
        terrainShadows: ShadowMode.ENABLED,
        contextOptions,
      });

      cesiumWidget.scene.globe.tileCacheSize = this.tileCacheSize;
      cesiumWidget.scene.globe.baseColor = this.globeColor;

      this.dataSourceDisplay = new DataSourceDisplay({
        scene: cesiumWidget.scene,
        dataSourceCollection: new DataSourceCollection(),
      });

      const { clock } = cesiumWidget;
      clock.shouldAnimate = true;
      this._listeners.push(
        clock.onTick.addEventListener(() => {
          this.dataSourceDisplayClock.tick();
          const time = this.dataSourceDisplayClock.currentTime;
          this.dataSourceDisplay?.update?.(time);
        }),
      );

      cesiumWidget.scene.shadowMap.maximumDistance = 5000.0;
      cesiumWidget.scene.shadowMap.darkness = 0.6;
      cesiumWidget.scene.globe.depthTestAgainstTerrain = true;
      cesiumWidget.scene.highDynamicRange = false;
      // cesiumWidget.scene.logarithmicDepthBuffer = false; // TODO observe this
      cesiumWidget.scene.splitPosition = this.splitPosition;
      cesiumWidget.scene.light.intensity = this._lightIntensity;

      cesiumWidget.scene.globe.enableLighting = this.enableLightning;

      this.initialized = true;
      this._initializeCesiumWidget(cesiumWidget);

      if (this._cameraLimiterOptions && !this._cameraLimiter) {
        this._cameraLimiter = new CameraLimiter(this._cameraLimiterOptions);
      }

      if (this._cameraLimiter) {
        this._setupPreUpdateListener();
      }

      this._defaultShadowMap = cesiumWidget.scene.shadowMap;

      if (this._initialShadowMap) {
        this.setShadowMap(this._initialShadowMap);
        this._initialShadowMap = undefined;
      }
    }
    return Promise.resolve();
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

  async gotoViewpoint(
    viewpoint: Viewpoint,
    optMaximumHeight?: number,
  ): Promise<void> {
    if (
      this.movementApiCallsDisabled ||
      !viewpoint.isValid() ||
      !this._cesiumWidget
    ) {
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

  disableMovement(prevent: boolean | DisableMapControlOptions): void {
    super.disableMovement(prevent);

    if (this._cesiumWidget) {
      this._cesiumWidget.scene.screenSpaceCameraController.enableInputs =
        !this.movementPointerEventsDisabled;
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
        this._clockSyncListener = undefined;
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
          this._clockSyncListener = undefined;
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
   * Sets a shadow map on the scene of the cesiumMaps cesiumWidget. Raises an event if the shadow map changes. This function should be used to set the shadowMap instead of setting it directly on the scene.
   * @param shadowMap The shadowMap to assign to the scene of the cesium widget.
   */
  setShadowMap(shadowMap: ShadowMap): void {
    if (!shadowMap) {
      return;
    }

    if (!this._cesiumWidget) {
      this._initialShadowMap = shadowMap;
      return;
    }

    const { scene } = this._cesiumWidget;

    if (scene.shadowMap !== shadowMap) {
      scene.shadowMap = shadowMap;
      this.shadowMapChanged.raiseEvent(shadowMap);
    }
  }

  /**
   * Sets the default shadow map.
   */
  setDefaultShadowMap(): void {
    if (!this._cesiumWidget || !this._defaultShadowMap) {
      this._initialShadowMap = undefined;
      return;
    }

    this.setShadowMap(this._defaultShadowMap);
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

  protected override _indexChangedOnVisualization(
    vis: CesiumVisualisationType,
  ): void {
    if (vis instanceof CustomDataSource) {
      indexChangedOnDataSource(
        (this.dataSourceDisplay as DataSourceDisplay).dataSources,
        vis,
        this.layerCollection,
      );
    } else {
      super._indexChangedOnVisualization(vis);
    }
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

  async addClusterDataSource(dataSource: CustomDataSource): Promise<void> {
    const clusterDataSources = this.getClusterDatasources();
    if (!clusterDataSources) {
      throw new Error('Cannot add data source to uninitialized map');
    }
    if (this.validateVisualization(dataSource)) {
      this.addVisualization(dataSource);
      await ensureInDataSourceCollection(
        clusterDataSources,
        dataSource,
        this.layerCollection,
      );
    }
  }

  removeClusterDataSource(dataSource: CustomDataSource): void {
    this.removeVisualization(dataSource);
    if (
      this._clusterDataSourceDisplay &&
      !this._clusterDataSourceDisplay.isDestroyed() &&
      !this._clusterDataSourceDisplay.dataSources.isDestroyed()
    ) {
      this._clusterDataSourceDisplay.dataSources.remove(dataSource);
    }
  }

  /**
   * returns the cesium DataSourceDisplay Object
   */
  getDataSourceDisplay(): DataSourceDisplay | null {
    return this.dataSourceDisplay;
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

  toJSON(defaultOptions = CesiumMap.getDefaultOptions()): CesiumMapOptions {
    const config: CesiumMapOptions = super.toJSON(defaultOptions);

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

    if (this._lightIntensity !== defaultOptions.lightIntensity) {
      config.lightIntensity = this._lightIntensity;
    }

    if (
      this.useOriginalCesiumShader !== defaultOptions.useOriginalCesiumShader
    ) {
      config.useOriginalCesiumShader = this.useOriginalCesiumShader;
    }

    if (this._contextOptions !== defaultOptions.contextOptions) {
      config.contextOptions = structuredClone(this._contextOptions);
    }

    return config;
  }

  destroy(): void {
    if (this.dataSourceDisplay && !this.dataSourceDisplay.isDestroyed()) {
      this.dataSourceDisplay.destroy();
    }

    if (this._clockSyncListener) {
      this._clockSyncListener();
      this._clockSyncListener = undefined;
    }

    if (this._preUpdateListener) {
      this._preUpdateListener();
      this._preUpdateListener = undefined;
    }

    if (this._cameraLimiter) {
      this._cameraLimiter = null;
    }

    if (this._clusterDataSourceDisplay) {
      this._clusterDataSourceDisplay.destroy();
    }

    this._initialShadowMap = undefined;
    this._defaultShadowMap = null;
    this.shadowMapChanged.destroy();

    super.destroy();
  }
}

mapClassRegistry.registerClass(CesiumMap.className, CesiumMap);
export default CesiumMap;
