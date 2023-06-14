import { checkMaybe } from '@vcsuite/check';
// eslint-disable-next-line import/no-named-default
import type { default as OLStyle, StyleFunction } from 'ol/style/Style.js';
import CesiumTilesetLayer, {
  CesiumTilesetOptions,
} from './cesiumTilesetLayer.js';
import DeclarativeStyleItem, {
  DeclarativeStyleItemOptions,
} from '../style/declarativeStyleItem.js';
import VectorStyleItem, {
  VectorStyleItemOptions,
} from '../style/vectorStyleItem.js';
import CesiumMap from '../map/cesiumMap.js';
import CesiumTilesetCesiumImpl from './cesium/cesiumTilesetCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import StyleItem from '../style/styleItem.js';
import VcsMap from '../map/vcsMap.js';

export type PointCloudOptions = CesiumTilesetOptions & {
  pointSize?: number | string;
};

export const defaultPointCloudStyle = new DeclarativeStyleItem({});

/**
 * represents a specific PointCloudLayer layer for cesium.
 * <h3>Config Parameter</h3>
 * <ul>
 *  <li>url: string: url to the p3dm dataset
 *  <li>pointSize: number: size of the points to display
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
    };
  }

  /**
   * The default point size to fall back on, if no point size is given. Uses Cesium default of 1 if null.
   */
  defaultPointSize: number | string | undefined;

  private _pointSize: number | string | undefined;

  protected _supportedMaps = [CesiumMap.className];

  constructor(options: PointCloudOptions) {
    super(options);

    const defaultOptions = PointCloudLayer.getDefaultOptions();

    this.defaultPointSize =
      options.pointSize != null ? options.pointSize : defaultOptions.pointSize;
    this._pointSize = this.defaultPointSize;
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
      defaultStyle || defaultPointCloudStyle,
    );
  }

  get pointSize(): number | string | undefined {
    return this._pointSize;
  }

  set pointSize(size: string | number | undefined) {
    checkMaybe(size, [Number, String]);
    this._pointSize = size;
    (this.style as DeclarativeStyleItem).pointSize = size?.toString();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.pointSize = this._pointSize;
  }

  createImplementationsForMap(map: VcsMap): CesiumTilesetCesiumImpl[] {
    if (map instanceof CesiumMap) {
      return [
        new CesiumTilesetCesiumImpl(map, this.getImplementationOptions()),
      ];
    }

    return [];
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

  toJSON(): PointCloudOptions {
    const config: PointCloudOptions = super.toJSON();
    const defaultOptions = PointCloudLayer.getDefaultOptions();

    if (this.defaultPointSize !== defaultOptions.pointSize) {
      config.pointSize = this.defaultPointSize;
    }

    return config;
  }
}

layerClassRegistry.registerClass(PointCloudLayer.className, PointCloudLayer);
export default PointCloudLayer;
