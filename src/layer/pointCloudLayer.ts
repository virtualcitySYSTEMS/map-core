import { check, maybe, oneOf } from '@vcsuite/check';
// eslint-disable-next-line import/no-named-default
import type { default as OLStyle, StyleFunction } from 'ol/style/Style.js';
import type {
  CesiumTilesetOptions,
  CesiumTilesetImplementationOptions,
} from './cesiumTilesetLayer.js';
import CesiumTilesetLayer from './cesiumTilesetLayer.js';
import type { DeclarativeStyleItemOptions } from '../style/declarativeStyleItem.js';
import type DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import { defaultDeclarativeStyle } from '../style/declarativeStyleItem.js';
import type { VectorStyleItemOptions } from '../style/vectorStyleItem.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import { layerClassRegistry } from '../classRegistry.js';
import type StyleItem from '../style/styleItem.js';
import BaseCesiumMap from '../map/baseCesiumMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import type VcsMap from '../map/vcsMap.js';

export type PointCloudOptions = CesiumTilesetOptions & {
  pointSize?: number | string;
  /**
   * if true, the point cloud is additionally rendered into the depth pass of panorama maps, even if the layer is not active.
   */
  renderDepthPass?: boolean;
};

/**
 * represents a specific PointCloudLayer layer for cesium.
 * <h3>Config Parameter</h3>
 * <ul>
 *  <li>url: string: url to the p3dm dataset
 *  <li>pointSize: number: size of the points to display
 *  <li>renderDepthPass: boolean: render the point cloud into the depth pass of panorama maps
 * </ul>
 * @group Layer
 */
class PointCloudLayer extends CesiumTilesetLayer {
  static get className(): string {
    return 'PointCloudLayer';
  }

  static getDefaultOptions(): PointCloudOptions {
    return {
      ...CesiumTilesetLayer.getDefaultOptions(),
      pointSize: undefined,
      renderDepthPass: false,
    };
  }

  /**
   * The default point size to fall back on, if no point size is given. Uses Cesium default of 1 if null.
   */
  defaultPointSize: number | string | undefined;

  private _pointSize: number | string | undefined;

  private _renderDepthPass: boolean;

  constructor(options: PointCloudOptions) {
    const defaultOptions = PointCloudLayer.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.defaultPointSize =
      options.pointSize != null ? options.pointSize : defaultOptions.pointSize;
    this._pointSize = this.defaultPointSize;

    this._renderDepthPass =
      options.renderDepthPass ?? defaultOptions.renderDepthPass ?? false;
  }

  getImplementationOptions(): CesiumTilesetImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      renderDepthPass: this.renderDepthPass,
    };
  }

  getStyleOrDefaultStyle(
    styleOptions?:
      | DeclarativeStyleItemOptions
      | VectorStyleItemOptions
      | StyleItem,
    defaultStyle?: VectorStyleItem | DeclarativeStyleItem,
  ): StyleItem {
    return super.getStyleOrDefaultStyle(
      styleOptions,
      defaultStyle || defaultDeclarativeStyle,
    );
  }

  get renderDepthPass(): boolean {
    return this._renderDepthPass;
  }

  set renderDepthPass(value: boolean) {
    if (this._renderDepthPass !== value) {
      this._renderDepthPass = value;
      this.forceRedraw().catch((e: unknown) => {
        this.getLogger().error(
          `Error forcing redraw after setting renderDepthPass: ${String(e)}`,
        );
      });
    }
  }

  get pointSize(): number | string | undefined {
    return this._pointSize;
  }

  set pointSize(size: string | number | undefined) {
    check(size, maybe(oneOf(Number, String)));
    this._pointSize = size;
    (this.style as DeclarativeStyleItem).pointSize = size?.toString();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.pointSize = this._pointSize;
  }

  /**
   * Point clouds rendering a depth pass are always supported by panorama maps, regardless of the maps layer types.
   */
  override isSupported(map: VcsMap): boolean {
    if (this.renderDepthPass && map instanceof PanoramaMap) {
      return true;
    }
    return super.isSupported(map);
  }

  /**
   * Initializes the implementation for depth pass point clouds, even if the layer is not active.
   * The implementation is not activated: its tileset stays hidden and is only rendered by the depth pass.
   */
  async mapActivated(map: VcsMap): Promise<void> {
    await super.mapActivated(map);
    if (
      this.renderDepthPass &&
      !this.active &&
      map instanceof BaseCesiumMap &&
      this.isSupported(map)
    ) {
      if (!this.initialized) {
        await this.initialize();
      }
      const [impl] = this.getImplementationsForMap(map);
      await impl?.initialize();
    }
  }

  /**
   * Clears the style of this layer resets the point size to the defaultPointSize
   */
  clearStyle(): void {
    super.clearStyle();
    this.pointSize = this.defaultPointSize;
  }

  /**
   * Sets a new declarative style. Cannot set a VectorLayer style on PointCloudLayer layers.
   */
  setStyle(style: OLStyle | StyleFunction | StyleItem, silent?: boolean): void {
    if (style instanceof VectorStyleItem) {
      this.getLogger().warning(
        'trying to apply vector style to point cloud layer.',
      );
    } else {
      super.setStyle(style, silent);
    }
  }

  toJSON(
    defaultOptions = PointCloudLayer.getDefaultOptions(),
  ): PointCloudOptions {
    const config: PointCloudOptions = super.toJSON(defaultOptions);

    if (this.defaultPointSize !== defaultOptions.pointSize) {
      config.pointSize = this.defaultPointSize;
    }

    if (this.renderDepthPass !== defaultOptions.renderDepthPass) {
      config.renderDepthPass = this.renderDepthPass;
    }

    return config;
  }
}

layerClassRegistry.registerClass(PointCloudLayer.className, PointCloudLayer);
export default PointCloudLayer;
