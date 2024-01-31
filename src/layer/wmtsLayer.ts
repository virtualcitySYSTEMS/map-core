import { parseInteger } from '@vcsuite/parsers';
import { getLogger } from '@vcsuite/logger';
import type { Size } from 'ol/size.js';
import type { Options as OLWMTSOptions } from 'ol/source/WMTS.js';

import RasterLayer, {
  RasterLayerImplementationOptions,
  RasterLayerOptions,
  TilingScheme,
} from './rasterLayer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import WmtsOpenlayersImpl from './openlayers/wmtsOpenlayersImpl.js';
import WmtsCesiumImpl from './cesium/wmtsCesiumImpl.js';
import { layerClassRegistry } from '../classRegistry.js';
import type VcsMap from '../map/vcsMap.js';

export type WMTSOptions = RasterLayerOptions & {
  layer: string;
  wmtsStyle?: string;
  format?: string;
  tileMatrixSetID?: string;
  tileMatrixPrefix?: string;
  matrixIds: string[];
  numberOfLevelZeroTilesX?: number;
  numberOfLevelZeroTilesY?: number;
  openlayersOptions?: Partial<OLWMTSOptions>;
  tileSize?: Size;
};

export type WMTSImplementationOptions = RasterLayerImplementationOptions & {
  layer: string;
  style: string;
  format: string;
  tileMatrixSetID: string;
  tileSize: import('ol/size.js').Size;
  numberOfLevelZeroTilesX: number;
  numberOfLevelZeroTilesY: number;
  matrixIds: string[];
  openlayersOptions: Partial<OLWMTSOptions>;
};

function getMatrixIds(
  matrixIds: string[],
  maxLevel: number,
  prefix: string,
): string[] {
  if (matrixIds.length > 0) {
    if (matrixIds.length === maxLevel + 1) {
      return matrixIds;
    } else {
      getLogger('WmtsCesiumImpl').log(
        'matrixIds must have the same length as maxLevel',
      );
    }
  }
  return new Array(maxLevel + 1).fill(undefined).map((_value, index) => {
    return `${prefix}${index}`;
  });
}

/**
 * @group Layer
 */
class WMTSLayer extends RasterLayer<WmtsCesiumImpl | WmtsOpenlayersImpl> {
  static get className(): string {
    return 'WMTSLayer';
  }

  static getDefaultOptions(): WMTSOptions {
    return {
      ...RasterLayer.getDefaultOptions(),
      tilingSchema: TilingScheme.MERCATOR,
      numberOfLevelZeroTilesX: 1,
      numberOfLevelZeroTilesY: 1,
      layer: '',
      wmtsStyle: '',
      format: '',
      tileMatrixPrefix: '',
      tileMatrixSetID: '',
      openlayersOptions: {},
      matrixIds: [],
      tileSize: [256, 256],
    };
  }

  numberOfLevelZeroTilesX: number;

  numberOfLevelZeroTilesY: number;

  layer: string;

  wmtsStyle: string;

  format: string;

  tileMatrixPrefix: string;

  tileMatrixSetID: string;

  openlayersOptions: Partial<OLWMTSOptions>;

  matrixIds: string[];

  tileSize: Size;

  constructor(options: WMTSOptions) {
    const defaultOptions = WMTSLayer.getDefaultOptions();
    super({ tilingSchema: defaultOptions.tilingSchema, ...options });

    this._supportedMaps = [OpenlayersMap.className, CesiumMap.className];

    this.numberOfLevelZeroTilesX = parseInteger(
      options.numberOfLevelZeroTilesX,
      defaultOptions.numberOfLevelZeroTilesX,
    );

    this.numberOfLevelZeroTilesY = parseInteger(
      options.numberOfLevelZeroTilesY,
      defaultOptions.numberOfLevelZeroTilesY,
    );

    this.layer = options.layer || defaultOptions.layer;

    this.wmtsStyle = options.wmtsStyle || (defaultOptions.wmtsStyle as string);

    this.format = options.format || (defaultOptions.format as string);

    this.tileMatrixPrefix =
      options.tileMatrixPrefix || (defaultOptions.tileMatrixPrefix as string);

    this.tileMatrixSetID =
      options.tileMatrixSetID || (defaultOptions.tileMatrixSetID as string);

    this.openlayersOptions =
      options.openlayersOptions || defaultOptions.openlayersOptions || {};

    this.matrixIds = Array.isArray(options.matrixIds)
      ? options.matrixIds
      : defaultOptions.matrixIds;

    this.tileSize = options.tileSize || (defaultOptions.tileSize as Size);
  }

  getImplementationOptions(): WMTSImplementationOptions {
    return {
      ...super.getImplementationOptions(),
      layer: this.layer,
      style: this.wmtsStyle,
      format: this.format,
      tileMatrixSetID: this.tileMatrixSetID,
      tileSize: this.tileSize,
      numberOfLevelZeroTilesX: this.numberOfLevelZeroTilesX,
      numberOfLevelZeroTilesY: this.numberOfLevelZeroTilesY,
      matrixIds: getMatrixIds(
        this.matrixIds,
        this.maxLevel,
        this.tileMatrixPrefix,
      ),
      openlayersOptions: this.openlayersOptions,
    };
  }

  createImplementationsForMap(
    map: VcsMap,
  ): (WmtsOpenlayersImpl | WmtsCesiumImpl)[] {
    if (map instanceof OpenlayersMap) {
      return [new WmtsOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new WmtsCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  toJSON(): WMTSOptions {
    const config: Partial<WMTSOptions> = super.toJSON();
    const defaultOptions = WMTSLayer.getDefaultOptions();

    if (this.tilingSchema !== defaultOptions.tilingSchema) {
      config.tilingSchema = this.tilingSchema;
    } else {
      delete config.tilingSchema;
    }

    if (
      this.numberOfLevelZeroTilesX !== defaultOptions.numberOfLevelZeroTilesX
    ) {
      config.numberOfLevelZeroTilesX = this.numberOfLevelZeroTilesX;
    }

    if (
      this.numberOfLevelZeroTilesY !== defaultOptions.numberOfLevelZeroTilesY
    ) {
      config.numberOfLevelZeroTilesY = this.numberOfLevelZeroTilesY;
    }

    if (this.layer !== defaultOptions.layer) {
      config.layer = this.layer;
    }

    if (this.wmtsStyle !== defaultOptions.wmtsStyle) {
      config.wmtsStyle = this.wmtsStyle;
    }

    if (this.format !== defaultOptions.format) {
      config.format = this.format;
    }

    if (this.tileMatrixPrefix !== defaultOptions.tileMatrixPrefix) {
      config.tileMatrixPrefix = this.tileMatrixPrefix;
    }

    if (this.tileMatrixSetID !== defaultOptions.tileMatrixSetID) {
      config.tileMatrixSetID = this.tileMatrixSetID;
    }

    if (Object.keys(this.openlayersOptions).length > 0) {
      config.openlayersOptions = { ...this.openlayersOptions };
    }

    if (this.matrixIds.length > 0) {
      config.matrixIds = this.matrixIds.slice();
    }

    if (
      this.tileSize[0] !== defaultOptions?.tileSize?.[0] ||
      this.tileSize[1] !== defaultOptions.tileSize[1]
    ) {
      config.tileSize = this.tileSize.slice();
    }

    return config as WMTSOptions;
  }
}

layerClassRegistry.registerClass(WMTSLayer.className, WMTSLayer);
export default WMTSLayer;
