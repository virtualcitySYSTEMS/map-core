import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import RTree from 'rbush';
import knn from 'rbush-knn';
import { Coordinate } from 'ol/coordinate.js';
import { Point } from 'ol/geom.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import FlatGeobufTileProvider from '../layer/tileProvider/flatGeobufTileProvider.js';
import VectorTileLayer from '../layer/vectorTileLayer.js';
import { markVolatile } from '../vcsModule.js';
import LayerState from '../layer/layerState.js';
import { PrimitiveOptionsType } from '../layer/vectorProperties.js';
import { createPanoramaImageFromURL, PanoramaImage } from './panoramaImage.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import {
  getSearchExtent,
  loadTreeLeaves,
  PanoramaRTreeNode,
} from './packedTree.js';
import Extent from '../util/extent.js';
import { cartesian2DDistanceSquared } from '../util/math.js';

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
      cameraOffset: -2.8,
    };
  }

  readonly baseUrl: string;

  activeOnStartup = false;

  cameraOffset = -2.8;

  private _treeLeaves: RTree<PanoramaRTreeNode> | undefined;

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

  // there can be optimizations done here, like using the tree and sort based on closest nodes before searching
  async getClosestImage(
    coordinate: Coordinate,
    maxDistance?: number,
  ): Promise<{ image: PanoramaImage; distance: number } | undefined> {
    const reader =
      await this.tileProvider.getReaderAndProjection(DATASET_TILE_LEVEL);

    if (!this._treeLeaves) {
      const nodes = await loadTreeLeaves(reader);
      this._treeLeaves = new RTree();
      this._treeLeaves.load(nodes);
    }

    const closesNode = knn(
      this._treeLeaves,
      coordinate[0],
      coordinate[1],
      1,
      undefined,
      maxDistance,
    );
    if (closesNode.length === 0) {
      return undefined;
    }

    const searchExtent = getSearchExtent(coordinate, closesNode[0]);
    const features = await this.tileProvider.getFeaturesForExtent(
      new Extent({
        coordinates: searchExtent,
        projection: mercatorProjection.toJSON(),
      }),
      DATASET_TILE_LEVEL,
    );
    let minDistanceSqrd = Infinity;
    let closestImageName: string | undefined;
    features.forEach((feature) => {
      const imagePosition = (feature.getGeometry() as Point).getCoordinates();
      const distanceSqrd = cartesian2DDistanceSquared(
        imagePosition,
        coordinate,
      );

      if (distanceSqrd < minDistanceSqrd) {
        minDistanceSqrd = distanceSqrd;
        closestImageName = feature.get('name') as string;
      }
    });

    if (closestImageName) {
      const image = await this.createPanoramaImage(closestImageName);
      return { image, distance: Math.sqrt(minDistanceSqrd) };
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
