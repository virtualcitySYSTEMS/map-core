import { parseBoolean, parseInteger, parseNumber } from '@vcsuite/parsers';
import type { Coordinate } from 'ol/coordinate.js';
import type { Point } from 'ol/geom.js';
import { buffer, createOrUpdateFromCoordinate } from 'ol/extent.js';
import type { VcsObjectOptions } from '../vcsObject.js';
import VcsObject from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import FlatGeobufTileProvider from '../layer/tileProvider/flatGeobufTileProvider.js';
import { markVolatile } from '../vcsModule.js';
import type { PanoramaImage } from './panoramaImage.js';
import { createPanoramaImageFromURL } from './panoramaImage.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import Extent from '../util/extent.js';
import { cartesian2DDistanceSquared } from '../util/math.js';
import PanoramaDatasetLayer from '../layer/panoramaDatasetLayer.js';
import { panoramaFeature } from '../layer/vectorSymbols.js';
import { PanoramaImageCache } from './panoramaImageCache.js';

export type PanoramaDatasetOptions = VcsObjectOptions & {
  url: string;
  baseLevel?: number;
  activeOnStartup?: boolean;
  cameraOffset?: number;
};

export type PanoramaDatasetFeatureProperties = {
  name: string;
  time: string;
  dataset: PanoramaDataset;
};

export enum PanoramaDatasetState {
  INACTIVE = 1,
  ACTIVE = 2,
}

export default class PanoramaDataset extends VcsObject {
  static get className(): string {
    return 'PanoramaDataset';
  }

  static getDefaultOptions(): PanoramaDatasetOptions {
    return {
      url: '',
      baseLevel: 15,
      activeOnStartup: false,
      cameraOffset: 0,
    };
  }

  private _state: PanoramaDatasetState = PanoramaDatasetState.INACTIVE;

  readonly baseUrl: string;

  readonly baseLevel: number;

  activeOnStartup = false;

  /**
   * The camera offset in meters. This can be used to correct a height offset in the data.
   */
  cameraOffset: number;

  readonly tileProvider: FlatGeobufTileProvider;

  readonly layer: PanoramaDatasetLayer;

  readonly stateChanged: VcsEvent<PanoramaDatasetState> =
    new VcsEvent<PanoramaDatasetState>();

  private _cache = new PanoramaImageCache();

  constructor(options: PanoramaDatasetOptions) {
    super(options);
    const defaultOptions = PanoramaDataset.getDefaultOptions();

    this.baseUrl = options.url.split('/').slice(0, -1).join('/');
    this.baseLevel = parseInteger(options.baseLevel, defaultOptions.baseLevel);

    this.tileProvider = new FlatGeobufTileProvider({
      idProperty: 'name',
      projection: wgs84Projection.toJSON(),
      levels: [
        {
          url: options.url,
          level: this.baseLevel,
        },
      ],
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

    this.cameraOffset = parseNumber(
      options.cameraOffset,
      defaultOptions.cameraOffset,
    );

    this.layer = new PanoramaDatasetLayer(this);
    markVolatile(this.layer);
    this.layer.stateChanged.addEventListener(() => {
      if (this.layer.active && !this.active) {
        this.activate();
      }
    });

    this.activeOnStartup = parseBoolean(
      options.activeOnStartup,
      defaultOptions.activeOnStartup,
    );

    if (this.activeOnStartup) {
      this.activate();
    }
  }

  get state(): PanoramaDatasetState {
    return this._state;
  }

  get active(): boolean {
    return this._state === PanoramaDatasetState.ACTIVE;
  }

  /**
   * Activates the dataset. This will not automatically activate the layer.
   * But activating the layer will activate the dataset.
   * Active datasets will be queried for new images.
   */
  activate(): void {
    if (!this.active) {
      this._state = PanoramaDatasetState.ACTIVE;
      this.stateChanged.raiseEvent(PanoramaDatasetState.ACTIVE);
    }
  }

  /**
   * Deactivates the dataset. This will also deactivate the layer, should it be active.
   * This will prevent new images from being queried from this dataset. Should an
   * image of this dataset currently be active, it will remain active.
   */
  deactivate(): void {
    if (this.active) {
      this._state = PanoramaDatasetState.INACTIVE;
      this.layer.deactivate();
      this.stateChanged.raiseEvent(PanoramaDatasetState.INACTIVE);
    }
  }

  /**
   * Creates a panorama image with the given name, if it belongs to this dataset.
   * Will cache the image for later use.
   * @param name
   * @returns
   */
  async createPanoramaImage(name: string): Promise<PanoramaImage> {
    const imageUrl = `${this.baseUrl}/${name}_rgb.tif`;
    if (this._cache.containsKey(imageUrl)) {
      return this._cache.get(imageUrl);
    }
    const image = await createPanoramaImageFromURL(imageUrl, this);
    this._cache.set(imageUrl, image);
    this._cache.expireCache();

    return image;
  }

  async getExtent(): Promise<Extent | undefined> {
    return this.tileProvider.getLevelExtent(this.baseLevel);
  }

  /**
   * Returns the closes image name to the coordinate within the given distance &
   * the distance squared to the coordinate.
   * @param coordinate - in web mercator
   * @param maxDistance - in meters
   * @returns - the closest image name and the distance squared to the coordinate
   */
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
      this.baseLevel,
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

    const config: PanoramaDatasetOptions = {
      ...super.toJSON(),
      url: levels[0].url,
    };

    const defaultOptions = PanoramaDataset.getDefaultOptions();
    if (this.baseLevel !== defaultOptions.baseLevel) {
      config.baseLevel = this.baseLevel;
    }
    if (this.activeOnStartup !== defaultOptions.activeOnStartup) {
      config.activeOnStartup = this.activeOnStartup;
    }
    if (this.cameraOffset !== defaultOptions.cameraOffset) {
      config.cameraOffset = this.cameraOffset;
    }

    return config;
  }

  destroy(): void {
    this.layer.deactivate();
    this.layer.destroy();
    this.stateChanged.destroy();
    this._cache.clear();
    super.destroy();
  }
}
