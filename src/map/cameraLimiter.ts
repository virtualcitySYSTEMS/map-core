import deepEqual from 'fast-deep-equal';
import {
  Camera,
  Cartographic,
  Ellipsoid,
  Math as CesiumMath,
  sampleTerrain,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import { check, maybe } from '@vcsuite/check';
import { parseInteger, parseNumber, parseEnumValue } from '@vcsuite/parsers';
import {
  getTerrainProviderForUrl,
  isTerrainTileAvailable,
} from '../layer/terrainHelpers.js';

/**
 * Enumeration of camera limiter modes.
 */
export enum CameraLimiterMode {
  HEIGHT = 'height',
  DISTANCE = 'distance',
}

export type CameraLimiterOptions = {
  /**
   *  required if mode is distance.
   */
  terrainUrl?: string;
  /**
   * if mode is distance this can be used to send headers with each request to the terrainUrl
   */
  terrainRequestHeaders?: Record<string, string>;
  /**
   * @default 'height'
   */
  mode?: CameraLimiterMode;
  /**
   * @default 200
   */
  limit?: number;
  /**
   * the level at which to request terrain data. setting this to null will request most detailed
   * @default 12
   */
  level?: number | null;
};

/**
 * Can limit a Cesium.Cameras position based on absolute height or distance to a given terrain
 */
class CameraLimiter {
  static get className(): string {
    return 'CameraLimiter';
  }

  static getDefaultOptions(): CameraLimiterOptions {
    return {
      mode: CameraLimiterMode.HEIGHT,
      terrainUrl: undefined,
      terrainRequestHeaders: undefined,
      limit: 200,
      level: 12,
    };
  }

  /**
   * The mode to use. When using DISTANCE mode, be sure to have a terrainProvider set.
   */
  mode: CameraLimiterMode;

  private _terrainUrl: string | undefined;

  /**
   * The minimum height/distance to the terrain the camera must maintain
   */
  limit: number;

  /**
   * The level to request terrain data at
   */
  level: number | null;

  /**
   * last checked camera position
   */
  lastCheckedPosition = new Cartographic();

  terrainRequestHeaders?: Record<string, string>;

  /**
   * last updated terrain height
   */
  private _terrainHeight: number | null = null;

  private _updatingTerrainHeight = false;

  constructor(options: CameraLimiterOptions) {
    const defaultOptions = CameraLimiter.getDefaultOptions();
    this.mode = parseEnumValue(
      options.mode,
      CameraLimiterMode,
      defaultOptions.mode as CameraLimiterMode,
    );

    this._terrainUrl = options.terrainUrl || defaultOptions.terrainUrl;
    this.limit = parseNumber(options.limit, defaultOptions.limit);
    this.level =
      options.level === null
        ? null
        : parseInteger(options.level, defaultOptions.level as number);
    this.terrainRequestHeaders = options.terrainRequestHeaders;
  }

  /**
   * The url of the terrain to use. Required for mode DISTANCE
   */
  get terrainUrl(): string | undefined {
    return this._terrainUrl;
  }

  set terrainUrl(url: string | undefined) {
    check(url, maybe(String));

    if (this._terrainUrl !== url) {
      this._terrainUrl = url;
    }
  }

  private async _limitWithLevel(
    cameraCartographic: Cartographic,
  ): Promise<Cartographic[]> {
    const terrainProvider = await getTerrainProviderForUrl(
      this.terrainUrl as string,
      {},
      this.terrainRequestHeaders,
    );
    if (
      this.level &&
      isTerrainTileAvailable(terrainProvider, this.level, cameraCartographic)
    ) {
      return sampleTerrain(terrainProvider, this.level, [cameraCartographic]);
    }
    return this._limitMostDetailed(cameraCartographic);
  }

  private async _limitMostDetailed(
    cameraCartographic: Cartographic,
  ): Promise<Cartographic[]> {
    const terrainProvider = await getTerrainProviderForUrl(
      this.terrainUrl as string,
      {},
      this.terrainRequestHeaders,
    );
    return sampleTerrainMostDetailed(terrainProvider, [cameraCartographic]);
  }

  private async _updateTerrainHeight(
    cameraCartographic: Cartographic,
  ): Promise<void> {
    if (
      !this._updatingTerrainHeight &&
      !cameraCartographic.equalsEpsilon(
        this.lastCheckedPosition,
        CesiumMath.EPSILON5,
      )
    ) {
      this._updatingTerrainHeight = true;
      const [updatedPosition] =
        this.level != null
          ? await this._limitWithLevel(cameraCartographic.clone())
          : await this._limitMostDetailed(cameraCartographic.clone());
      this._terrainHeight = updatedPosition.height;
      this.lastCheckedPosition = cameraCartographic;
      this._updatingTerrainHeight = false;
    }
  }

  /**
   * Limits the given camera based on this limiters specs.
   */
  limitCamera(camera: Camera): Promise<void> {
    let promise = Promise.resolve();
    const cameraCartographic = Cartographic.fromCartesian(camera.position);
    if (cameraCartographic) {
      if (this.mode === CameraLimiterMode.DISTANCE && this.terrainUrl) {
        promise = this._updateTerrainHeight(cameraCartographic);
        if (
          this._terrainHeight &&
          cameraCartographic.height - this._terrainHeight < this.limit
        ) {
          const newHeight = this._terrainHeight + this.limit;
          Cartographic.toCartesian(
            new Cartographic(
              cameraCartographic.longitude,
              cameraCartographic.latitude,
              newHeight,
            ),
            Ellipsoid.WGS84,
            camera.position,
          );
        }
      } else if (cameraCartographic.height < this.limit) {
        Cartographic.toCartesian(
          new Cartographic(
            cameraCartographic.longitude,
            cameraCartographic.latitude,
            this.limit,
          ),
          Ellipsoid.WGS84,
          camera.position,
        );
      }
    }
    return promise;
  }

  toJSON(): CameraLimiterOptions {
    const config: CameraLimiterOptions = {};
    const defaultOptions = CameraLimiter.getDefaultOptions();
    if (this.terrainUrl) {
      config.terrainUrl = this.terrainUrl;
    }

    if (this.limit !== defaultOptions.limit) {
      config.limit = this.limit;
    }

    if (this.mode !== defaultOptions.mode) {
      config.mode = this.mode;
    }

    if (this.level !== defaultOptions.level) {
      config.level = this.level;
    }
    if (
      !deepEqual(
        this.terrainRequestHeaders,
        defaultOptions.terrainRequestHeaders,
      )
    ) {
      config.terrainRequestHeaders = this.terrainRequestHeaders;
    }
    return config;
  }
}

export default CameraLimiter;
