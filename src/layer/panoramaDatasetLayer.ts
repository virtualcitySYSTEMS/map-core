import VectorTileLayer, { VectorTileImpls } from './vectorTileLayer.js';
import type PanoramaDataset from '../panorama/panoramaDataset.js';
import PanoramaDatasetPanoramaImpl from './panorama/panoramaDatasetPanoramaImpl.js';
import type VcsMap from '../map/vcsMap.js';
import PanoramaMap from '../map/panoramaMap.js';
import VectorProperties, { PrimitiveOptionsType } from './vectorProperties.js';
import { maxZIndexMin50 } from '../util/layerCollection.js';

export default class PanoramaDatasetLayer extends VectorTileLayer<PanoramaDatasetPanoramaImpl> {
  static get className(): string {
    return 'PanoramaDatasetLayer';
  }

  private _hideInPanorama = false;

  private _panoramaVectorProperties = new VectorProperties({});

  constructor(public readonly dataset: PanoramaDataset) {
    const color = 'rgba(255, 255, 255, 0.5)'; // XXX configurable

    super({
      tileProvider: dataset.tileProvider,
      vectorProperties: {
        altitudeMode: 'absolute',
        extrudedHeight: 1.8,
      },
      style: {
        fill: { color },
        image: {
          radius: 5,
          fill: { color },
          stroke: {
            color: 'rgb(0, 0, 0)',
            width: 1,
          },
        },
      },
      minLevel: 15,
      maxLevel: 22,
      zIndex: maxZIndexMin50,
    });

    this._panoramaVectorProperties = new VectorProperties({
      altitudeMode: 'absolute',
      primitiveOptions: {
        type: PrimitiveOptionsType.CYLINDER,
        geometryOptions: {
          topRadius: 1,
          bottomRadius: 1,
          length: 0.01,
        },
        offset: [0, 0, this.dataset.cameraOffset],
      },
    });
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

  override createImplementationsForMap<T extends VcsMap>(
    map: T,
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
}
