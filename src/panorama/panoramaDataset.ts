import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import {
  generateLevelBounds,
  NODE_ITEM_BYTE_LEN,
} from 'flatgeobuf/lib/mjs/packedrtree.js';
import knn from 'rbush-knn';
import { Extent } from 'ol/extent.js';
import { Coordinate } from 'ol/coordinate.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import FlatGeobufTileProvider from '../layer/tileProvider/flatGeobufTileProvider.js';
import { createTileCoordinate } from './panoramaTile.js';
import { mercatorToCartographic } from '../util/math.js';
import VectorTileLayer from '../layer/vectorTileLayer.js';
import { markVolatile } from '../vcsModule.js';
import LayerState from '../layer/layerState.js';
import { PrimitiveOptionsType } from '../layer/vectorProperties.js';
import { createPanoramaImageFromURL, PanoramaImage } from './panoramaImage.js';
import { wgs84Projection } from '../util/projection.js';

export type PanoramaDatasetOptions = VcsObjectOptions & {
  url: string;
  activeOnStartup?: boolean;
  cameraOffset?: number;
};

export const DATASET_TILE_LEVEL = 15;

export type PanoramaDatasetFeatureProperties = {
  name: string;
  time: string;
  dataset: PanoramaDataset;
};

export const panoramaFeature = Symbol('panoramaFeature');

export default class PanoramaDataset extends VcsObject {
  static get className(): string {
    return 'PanoramaDataset';
  }

  static getDefaultOptions(): PanoramaDatasetOptions {
    return {
      url: '',
      activeOnStartup: false,
      cameraOffset: -2,
    };
  }

  readonly baseUrl: string;

  activeOnStartup = false;

  cameraOffset = -2;

  private _dataExtent: Extent | undefined;

  readonly tileProvider: FlatGeobufTileProvider;

  readonly vectorTileLayer: VectorTileLayer;

  readonly stateChanged: VcsEvent<LayerState>;

  constructor(options: PanoramaDatasetOptions) {
    super(options);
    this.baseUrl = options.url.split('/').slice(0, -1).join('/');

    const defaultOptions = PanoramaDataset.getDefaultOptions();
    this.tileProvider = new FlatGeobufTileProvider({
      idProperty: 'name',
      projection: wgs84Projection.toJSON(),
      levels: [{ url: options.url, level: DATASET_TILE_LEVEL }],
    });

    this.tileProvider.tileLoadedEvent.addEventListener(({ rtree }) => {
      rtree.all().forEach(({ value: feature }) => {
        const { name, time } =
          feature.getProperties() as Partial<PanoramaDatasetFeatureProperties>;

        if (name && time) {
          feature[panoramaFeature] = {
            name,
            time,
            dataset: this,
          };
        }
      });
    });

    this.vectorTileLayer = new VectorTileLayer({
      tileProvider: this.tileProvider,
      vectorProperties: {
        altitudeMode: 'absolute',
        primitiveOptions: {
          type: PrimitiveOptionsType.CYLINDER,
          geometryOptions: {
            topRadius: 1,
            bottomRadius: 1,
            length: 0.01,
          },
          offset: [0, 0, this.cameraOffset],
          depthFailColor: 'rgba(244,0,130,0.91)',
        },
      },
    });
    markVolatile(this.vectorTileLayer);
    this.stateChanged = this.vectorTileLayer.stateChanged;

    this.activeOnStartup = parseBoolean(
      options.activeOnStartup,
      defaultOptions.activeOnStartup,
    );

    this.cameraOffset = parseNumber(
      options.cameraOffset,
      defaultOptions.cameraOffset,
    );

    if (this.activeOnStartup) {
      this.activate().catch(() => {
        this.getLogger().error('Error activating dataset');
      });
    }
  }

  get state(): LayerState {
    return this.vectorTileLayer.state;
  }

  get active(): boolean {
    return this.vectorTileLayer.active;
  }

  activate(): Promise<void> {
    return this.vectorTileLayer.activate();
  }

  deactivate(): void {
    this.vectorTileLayer.deactivate();
  }

  createPanoramaImage(name: string): Promise<PanoramaImage> {
    // XXX cache images
    return createPanoramaImageFromURL(`${this.baseUrl}/${name}_rgb.tif`, this);
  }

  async getClosestImage(
    coordinate: Coordinate,
    maxDistance?: number,
  ): Promise<PanoramaImage | undefined> {
    const reader =
      await this.tileProvider.getReaderAndProjection(DATASET_TILE_LEVEL);

    if (!this._dataExtent) {
      // TODO read in the lowest level of the hilbert tree, so we can determine the closest bottom leaf.
      const { header } = reader;
      const rootNodeRanges = generateLevelBounds(
        header.featuresCount,
        header.indexNodeSize,
      ).pop();

      if (rootNodeRanges) {
        const lengthBeforeTree = reader.lengthBeforeTree();

        // @ts-expect-error: not actually private
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const buffer = (await reader.headerClient.getRange(
          lengthBeforeTree,
          NODE_ITEM_BYTE_LEN,
          0,
          'index',
        )) as ArrayBuffer;
        const dataView = new DataView(buffer);
        const minX = dataView.getFloat64(0, true); // maxX < nodeMinX
        const minY = dataView.getFloat64(8, true); // maxY < nodeMinY
        const maxX = dataView.getFloat64(16, true); // minX > nodeMaxX
        const maxY = dataView.getFloat64(24, true); // minY > nodeMaxY

        this._dataExtent = [minX, minY, maxX, maxY];
        console.log(this._dataExtent);
      }
    }

    const tile = this.tileProvider.tilingScheme.positionToTileXY(
      mercatorToCartographic(coordinate),
      DATASET_TILE_LEVEL,
    );

    const tileCoordinate = createTileCoordinate(
      tile.x,
      tile.y,
      DATASET_TILE_LEVEL,
    );

    await this.tileProvider.getFeaturesForTile(
      tile.x,
      tile.y,
      DATASET_TILE_LEVEL,
    );

    const rtree = this.tileProvider.rtreeCache.get(tileCoordinate.key);
    if (rtree) {
      const closest = knn(
        rtree,
        coordinate[0],
        coordinate[1],
        1,
        undefined,
        maxDistance,
      );
      if (closest.length) {
        return this.createPanoramaImage(closest[0].value.get('name') as string);
      }
    }

    return undefined;
  }

  toJSON(): PanoramaDatasetOptions {
    const { levels } = this.tileProvider.toJSON();

    return {
      ...super.toJSON(),
      url: levels[0].url,
    };
  }
}
