import { parseInteger, parseNumber } from '@vcsuite/parsers';
import type { Coordinate } from 'ol/coordinate.js';
import { buffer, createOrUpdateFromCoordinate } from 'ol/extent.js';
import { type Point } from 'ol/geom.js';
import VectorTileLayer, {
  type VectorTileImpls,
  type VectorTileOptions,
} from './vectorTileLayer.js';
import PanoramaDatasetPanoramaImpl from './panorama/panoramaDatasetPanoramaImpl.js';
import type VcsMap from '../map/vcsMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import VectorProperties, { PrimitiveOptionsType } from './vectorProperties.js';
import { maxZIndexMin50 } from '../util/layerCollection.js';
import { layerClassRegistry } from '../classRegistry.js';
import FlatGeobufTileProvider from './tileProvider/flatGeobufTileProvider.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';
import { panoramaFeature } from './vectorSymbols.js';
import {
  createPanoramaImageFromURL,
  type PanoramaImage,
} from '../panorama/panoramaImage.js';
import Extent from '../util/extent.js';
import { cartesian2DDistanceSquared } from '../util/math.js';
import { getStyleOrDefaultStyle } from '../style/styleFactory.js';

export type PanoramaDatasetOptions = Omit<
  VectorTileOptions,
  'url' | 'tileProvider'
> & {
  url: string;
  baseLevel?: number;
  cameraOffset?: number;
};

export type PanoramaDatasetFeatureProperties = {
  name: string;
  time: string;
  dataset: PanoramaDatasetLayer;
};

export default class PanoramaDatasetLayer extends VectorTileLayer<PanoramaDatasetPanoramaImpl> {
  static get className(): string {
    return 'PanoramaDatasetLayer';
  }

  static getDefaultOptions(): PanoramaDatasetOptions {
    return {
      ...VectorTileLayer.getDefaultOptions(),
      url: '',
      baseLevel: 15,
      activeOnStartup: false,
      cameraOffset: 0,
      minLevel: 15,
      maxLevel: 22,
      zIndex: maxZIndexMin50,
    };
  }

  declare tileProvider: FlatGeobufTileProvider;

  private _hideInPanorama = false;

  private _panoramaVectorProperties = new VectorProperties({});

  private _dataExtent?: Extent;

  readonly baseUrl: string;

  readonly baseLevel: number;

  cameraOffset: number;

  constructor(options: PanoramaDatasetOptions) {
    const defaultOptions = PanoramaDatasetLayer.getDefaultOptions();

    const baseLevel = parseInteger(options.baseLevel, defaultOptions.baseLevel);

    const tileProvider = new FlatGeobufTileProvider({
      idProperty: 'name',
      projection: wgs84Projection.toJSON(),
      levels: [
        {
          url: options.url,
          level: baseLevel,
        },
      ],
    });

    super({
      ...defaultOptions,
      ...options,
      tileProvider,
    });

    tileProvider.tileLoadedEvent.addEventListener(({ rtree }) => {
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

    this.baseUrl = this.url.split('/').slice(0, -1).join('/');
    this.baseLevel = baseLevel;

    this.cameraOffset = parseNumber(
      options.cameraOffset,
      defaultOptions.cameraOffset,
    );

    this._panoramaVectorProperties = new VectorProperties({
      altitudeMode: 'absolute',
      primitiveOptions: {
        type: PrimitiveOptionsType.CYLINDER,
        geometryOptions: {
          topRadius: 1,
          bottomRadius: 1,
          length: 0.01,
        },
        offset: [0, 0, this.cameraOffset],
      },
    });

    this._supportedMaps.push(PanoramaMap.className);
  }

  override async initialize(): Promise<void> {
    if (!this.initialized) {
      this._dataExtent = await this.tileProvider.getLevelExtent(this.baseLevel);
    }
    await super.initialize();
  }

  get hideInPanorama(): boolean {
    return this._hideInPanorama;
  }

  set hideInPanorama(value: boolean) {
    if (this._hideInPanorama !== value) {
      this._hideInPanorama = value;
      this.getImplementations().forEach((impl) => {
        if (impl instanceof PanoramaDatasetPanoramaImpl) {
          impl.hideInPanorama = value;
        }
      });
    }
  }

  override createImplementationsForMap(
    map: VcsMap,
  ): (PanoramaDatasetPanoramaImpl | VectorTileImpls)[] {
    if (map instanceof PanoramaMap) {
      return [
        new PanoramaDatasetPanoramaImpl(map, {
          ...this.getImplementationOptions(),
          vectorProperties: this._panoramaVectorProperties,
          hideInPanorama: this.hideInPanorama,
        }),
      ];
    }
    return super.createImplementationsForMap(map);
  }

  /**
   * Creates a panorama image with the given name, if it belongs to this dataset.
   * Will cache the image for later use.
   * @param name
   * @returns
   */
  createPanoramaImage(name: string): Promise<PanoramaImage> {
    return createPanoramaImageFromURL(`${this.baseUrl}/${name}_rgb.tif`, this);
  }

  override getZoomToExtent(): Extent | null {
    const metaExtent = super.getZoomToExtent();
    if (metaExtent) {
      return metaExtent;
    }
    return this._dataExtent ?? null;
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

  override toJSON(): PanoramaDatasetOptions {
    const config = super.toJSON() as Partial<PanoramaDatasetOptions> &
      VectorTileOptions;
    delete config.tileProvider; // tileProvider is not serializable
    config.url = this.url;

    const defaultOptions = PanoramaDatasetLayer.getDefaultOptions();
    if (this.cameraOffset !== defaultOptions.cameraOffset) {
      config.cameraOffset = this.cameraOffset;
    }
    if (this.baseLevel !== defaultOptions.baseLevel) {
      config.baseLevel = this.baseLevel;
    }

    if (config.maxLevel === defaultOptions.maxLevel) {
      delete config.maxLevel;
    }

    if (config.minLevel === defaultOptions.minLevel) {
      delete config.minLevel;
    }

    if (config.zIndex === defaultOptions.zIndex) {
      delete config.zIndex;
    }

    const thisDefaultStyle = getStyleOrDefaultStyle(defaultOptions.style);
    if (this.style.equals(thisDefaultStyle)) {
      delete config.style;
    }

    return config as PanoramaDatasetOptions;
  }
}

layerClassRegistry.registerClass(
  PanoramaDatasetLayer.className,
  PanoramaDatasetLayer,
);
