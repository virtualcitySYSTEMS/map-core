import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import { Coordinate } from 'ol/coordinate.js';
import { Point } from 'ol/geom.js';
import { buffer, createOrUpdateFromCoordinate } from 'ol/extent.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import FlatGeobufTileProvider from '../layer/tileProvider/flatGeobufTileProvider.js';
import { markVolatile } from '../vcsModule.js';
import LayerState from '../layer/layerState.js';
import { createPanoramaImageFromURL, PanoramaImage } from './panoramaImage.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import Extent from '../util/extent.js';
import { cartesian2DDistanceSquared } from '../util/math.js';
import PanoramaDatasetLayer from '../layer/panoramaDatasetLayer.js';
import { panoramaFeature } from '../layer/vectorSymbols.js';

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

  readonly tileProvider: FlatGeobufTileProvider;

  readonly layer: PanoramaDatasetLayer;

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

    this.layer = new PanoramaDatasetLayer(this);
    markVolatile(this.layer);
    this.stateChanged = this.layer.stateChanged;

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
    return this.layer.state;
  }

  get active(): boolean {
    return this.layer.active;
  }

  activate(): Promise<void> {
    return this.layer.activate();
  }

  deactivate(): void {
    this.layer.deactivate();
  }

  createPanoramaImage(name: string): Promise<PanoramaImage> {
    // XXX cache images
    return createPanoramaImageFromURL(`${this.baseUrl}/${name}_rgb.tif`, this);
  }

  // there can be optimizations done here, like using the tree and sort based on closest nodes before searching
  async getClosestImage(
    coordinate: Coordinate,
    maxDistance = 200,
  ): Promise<{ imageName: string; distanceSqrd: number } | undefined> {
    const extent = createOrUpdateFromCoordinate(coordinate);
    buffer(extent, maxDistance, extent);
    const features = await this.tileProvider.getFeaturesForExtent(
      new Extent({
        coordinates: extent,
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
      return {
        imageName: closestImageName,
        distanceSqrd: minDistanceSqrd,
      };
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

  destroy(): void {
    this.layer.deactivate();
    this.layer.destroy();
    super.destroy();
  }
}
