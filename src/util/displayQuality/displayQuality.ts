import { check, oneOf } from '@vcsuite/check';
import VcsApp from '../../vcsApp.js';
import FeatureStoreLayer from '../../layer/featureStoreLayer.js';
import CesiumMap from '../../map/cesiumMap.js';
import { isMobile } from '../isMobile.js';
import CesiumTilesetLayer from '../../layer/cesiumTilesetLayer.js';
import VcsEvent from '../../vcsEvent.js';

export enum DisplayQualityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export type DisplayQualityViewModelOptions = {
  sse?: number;
  fxaa?: boolean;
  fogEnabled?: boolean;
  fogDensity?: number;
  fogScreenSpaceErrorFactor?: number;
  resolutionScale?: number;
  layerSSEFactor?: number;
  msaa?: 1 | 2 | 4 | 8;
};

export type DisplayQualityLayerModel = {
  layerName: string;
  defaultSse: number;
};

export type DisplayQualityOptions = {
  startingQualityLevel?: DisplayQualityLevel;
  startingMobileQualityLevel?: DisplayQualityLevel;
  low?: DisplayQualityViewModelOptions;
  medium?: DisplayQualityViewModelOptions;
  high?: DisplayQualityViewModelOptions;
};

/**
 * DisplayQuality Class
 */
class DisplayQuality {
  static get className(): string {
    return 'DisplayQuality';
  }

  static getDefaultOptions(): DisplayQualityOptions {
    return {
      startingQualityLevel: DisplayQualityLevel.MEDIUM,
      startingMobileQualityLevel: DisplayQualityLevel.LOW,
      low: {
        sse: 4,
        fxaa: false,
        fogEnabled: true,
        fogDensity: 0.0009,
        fogScreenSpaceErrorFactor: 6,
        resolutionScale: 0.9,
        layerSSEFactor: 2,
        msaa: 1,
      },
      medium: {
        sse: 2.333,
        fxaa: false,
        fogEnabled: true,
        fogDensity: 0.0005,
        fogScreenSpaceErrorFactor: 4,
        resolutionScale: 1,
        layerSSEFactor: 1.1,
        msaa: 1,
      },
      high: {
        sse: 4 / 3,
        fxaa: true,
        fogEnabled: false,
        fogDensity: 0,
        fogScreenSpaceErrorFactor: 0,
        resolutionScale: 1,
        layerSSEFactor: 0.5,
        msaa: 4,
      },
    };
  }

  private _app: VcsApp;

  private _layerSettingsCache: DisplayQualityLayerModel[];

  private _viewModelSettings: DisplayQualityOptions;

  private _currentQualityLevel: DisplayQualityLevel | undefined;

  private _listeners: (() => void)[];

  /**
   * An event raised when the current quality level has been changed
   */
  qualityLevelChanged = new VcsEvent<void>();

  constructor(app: VcsApp) {
    this._app = app;
    this._layerSettingsCache = [];
    this._viewModelSettings = DisplayQuality.getDefaultOptions();
    this._currentQualityLevel = undefined;
    this._listeners = [
      this._app.maps.mapActivated.addEventListener(() => {
        if (
          this._app.maps.activeMap instanceof CesiumMap &&
          !this.currentQualityLevel
        ) {
          if (isMobile()) {
            this.setLevel(this._viewModelSettings.startingMobileQualityLevel!);
          } else {
            this.setLevel(this._viewModelSettings.startingQualityLevel!);
          }
        }
      }),
      this._app.layers.stateChanged.addEventListener((layer) => {
        if (layer.active && this._app.maps.activeMap instanceof CesiumMap) {
          this._setLayerQuality(layer.name);
        }
      }),
      this._app.layers.removed.addEventListener((layer) => {
        const index = this._layerSettingsCache.findIndex(
          (config) => config.layerName === layer.name,
        );
        if (index > -1) {
          this._layerSettingsCache.splice(index, 1);
        }
      }),
    ];
  }

  /**
   * The starting quality level
   */
  get startingQualityLevel(): DisplayQualityLevel {
    return this._viewModelSettings.startingQualityLevel!;
  }

  /**
   * The current quality level
   */
  get currentQualityLevel(): DisplayQualityLevel | undefined {
    return this._currentQualityLevel;
  }

  /**
   * The current quality view model
   * @private
   */
  get _viewModel(): DisplayQualityViewModelOptions | undefined {
    if (this._currentQualityLevel) {
      return this._viewModelSettings[this._currentQualityLevel]!;
    }

    return undefined;
  }

  /**
   * Update the display quality options
   * @param options
   * @param silent
   */
  updateOptions(options: DisplayQualityOptions, silent?: boolean): void {
    check(options, Object);
    const filteredOptions: DisplayQualityOptions = Object.fromEntries(
      Object.entries(options as Record<string, unknown>)
        .filter(([, value]) => value != null)
        .map(([key, value]) => {
          if (
            key === DisplayQualityLevel.LOW ||
            key === DisplayQualityLevel.MEDIUM ||
            key === DisplayQualityLevel.HIGH
          ) {
            return [
              key,
              Object.fromEntries(
                Object.entries(value as Record<string, unknown>).filter(
                  ([innerKey, v]) => {
                    if (innerKey === 'msaa') {
                      return ([1, 2, 4, 8] as Array<unknown>).includes(v);
                    }
                    return v != null;
                  },
                ),
              ),
            ];
          }
          return [key, value];
        }),
    );
    const defaultOptions = DisplayQuality.getDefaultOptions();
    this._viewModelSettings = {
      ...defaultOptions,
      ...filteredOptions,
      low: { ...defaultOptions.low, ...filteredOptions.low },
      medium: { ...defaultOptions.medium, ...filteredOptions.medium },
      high: { ...defaultOptions.high, ...filteredOptions.high },
    };
    if (!silent) {
      if (this.currentQualityLevel) {
        this.setLevel(this.currentQualityLevel);
      } else if (isMobile()) {
        this.setLevel(this._viewModelSettings.startingMobileQualityLevel!);
      } else {
        this.setLevel(this._viewModelSettings.startingQualityLevel!);
      }
    }
  }

  /**
   * Set display quality level for 3D map and layers
   * @param level
   */
  setLevel(level: DisplayQualityLevel): void {
    check(
      level,
      oneOf(
        DisplayQualityLevel.LOW,
        DisplayQualityLevel.MEDIUM,
        DisplayQualityLevel.HIGH,
      ),
    );

    if (!(this._app.maps.activeMap instanceof CesiumMap)) {
      this._currentQualityLevel = undefined;
      this._viewModelSettings.startingQualityLevel = level;
      this._viewModelSettings.startingMobileQualityLevel = level;
      return;
    }

    const previousLevel = this._currentQualityLevel;
    this._currentQualityLevel = level;

    [...this._app.layers]
      .filter(
        (layer) =>
          layer.active &&
          (layer instanceof CesiumTilesetLayer ||
            layer instanceof FeatureStoreLayer),
      )
      .forEach((layer) => {
        this._setLayerQuality(layer.name);
      });

    const viewer = this._app.maps.activeMap.getCesiumWidget();
    if (viewer && this._viewModel) {
      viewer.scene.globe.maximumScreenSpaceError = this._viewModel.sse!;
      if (viewer.scene.postProcessStages) {
        viewer.scene.postProcessStages.fxaa.enabled = this._viewModel.fxaa!;
      }
      viewer.resolutionScale = this._viewModel.resolutionScale!;
      viewer.scene.fog.enabled = this._viewModel.fogEnabled!;
      viewer.scene.fog.density = this._viewModel.fogDensity!;
      viewer.scene.fog.screenSpaceErrorFactor =
        this._viewModel.fogScreenSpaceErrorFactor!;
      if (this._viewModel.msaa) {
        viewer.scene.msaaSamples = this._viewModel.msaa;
      }
    }

    if (this._currentQualityLevel !== previousLevel) {
      this.qualityLevelChanged.raiseEvent();
    }
  }

  /**
   * Set layer quality
   * @param layerName
   * @private
   */
  _setLayerQuality(layerName: string | undefined): void {
    check(layerName, String);

    const layer = this._app.layers.getByKey(layerName);
    if (
      (layer instanceof CesiumTilesetLayer ||
        layer instanceof FeatureStoreLayer) &&
      layer.active
    ) {
      let config = this._layerSettingsCache.find(
        (layerConfig) => layerConfig.layerName === layerName,
      );
      let sse;
      if (!config) {
        sse = isMobile()
          ? layer.screenSpaceErrorMobile
          : layer.screenSpaceError;
        if (sse) {
          config = {
            layerName: layer.name,
            defaultSse: sse,
          };
          this._layerSettingsCache.push(config);
        }
      }
      if (config && this._viewModel) {
        layer.setMaximumScreenSpaceError(
          config.defaultSse * this._viewModel.layerSSEFactor!,
        );
      }
    }
  }

  /**
   * Destroys the display quality, clearing its event listeners
   */
  destroy(): void {
    this._listeners.forEach((cb) => {
      cb();
    });
    this.qualityLevelChanged.destroy();
  }
}

export default DisplayQuality;
