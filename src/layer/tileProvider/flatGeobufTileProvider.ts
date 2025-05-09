import type Feature from 'ol/Feature.js';
import type { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js';
import type { TileProviderOptions } from './tileProvider.js';
import TileProvider, { rectangleToExtent } from './tileProvider.js';
import type { ProjectionOptions } from '../../util/projection.js';
import Projection, {
  getDefaultProjection,
  mercatorProjection,
} from '../../util/projection.js';
import Extent from '../../util/extent.js';
import { tileProviderClassRegistry } from '../../classRegistry.js';
import {
  getOlFeatures,
  getRootNode,
  getValidReader,
} from '../flatGeobufHelpers.js';

export type FlatGeobufTileProviderOptions = Omit<
  TileProviderOptions,
  'baseLevels'
> & {
  levels: { level: number; url: string }[];
  projection?: ProjectionOptions;
};

export default class FlatGeobufTileProvider extends TileProvider {
  static get className(): string {
    return 'FlatGeobufTileProvider';
  }

  static getDefaultOptions(): FlatGeobufTileProviderOptions {
    return {
      ...TileProvider.getDefaultOptions(),
      levels: [],
      projection: undefined,
    };
  }

  private _levels: Map<number, { url: string; reader?: HttpReader }>;

  private _projection: Projection;

  constructor(options: FlatGeobufTileProviderOptions) {
    const baseLevels = options.levels.map((level) => level.level);
    super({ ...options, baseLevels });

    this._levels = new Map(
      options.levels.map((level) => [level.level, { url: level.url }]),
    );

    this._projection = options.projection
      ? new Projection(options.projection)
      : new Projection();
  }

  async getReaderAndProjection(level: number): Promise<HttpReader> {
    const levelConfig = this._levels.get(level);
    if (!levelConfig) {
      throw new Error(`No url for level ${level}`);
    }
    if (!levelConfig.reader) {
      levelConfig.reader = await getValidReader(
        levelConfig.url,
        this._projection,
      );
    }

    return levelConfig.reader;
  }

  async getLevelExtent(level: number): Promise<Extent> {
    const reader = await this.getReaderAndProjection(level);
    const rootNode = await getRootNode(reader);

    return new Extent({
      coordinates: [rootNode.minX, rootNode.minY, rootNode.maxX, rootNode.maxY],
      projection: this._projection.toJSON(),
    });
  }

  async loader(x: number, y: number, z: number): Promise<Feature[]> {
    const rectangle = this.tilingScheme.tileXYToRectangle(x, y, z);
    const extent = rectangleToExtent(rectangle);
    const mercatorExtent = new Extent({
      coordinates: extent,
      projection: mercatorProjection,
    });

    const reader = await this.getReaderAndProjection(z);
    return getOlFeatures(reader, this._projection, mercatorExtent);
  }

  toJSON(): FlatGeobufTileProviderOptions {
    const config: FlatGeobufTileProviderOptions & { baseLevels?: number[] } = {
      levels: Array.from(this._levels.entries()).map(([level, { url }]) => ({
        level,
        url,
      })),
      ...super.toJSON(),
    };
    delete config.baseLevels;
    if (this._projection.epsg !== getDefaultProjection().epsg) {
      config.projection = this._projection.toJSON();
    }

    return config;
  }
}

tileProviderClassRegistry.registerClass(
  FlatGeobufTileProvider.className,
  FlatGeobufTileProvider,
);
