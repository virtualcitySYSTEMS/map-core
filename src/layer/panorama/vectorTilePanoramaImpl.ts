import { PrimitiveCollection, SplitDirection } from '@vcmap-cesium/engine';
import VectorSource from 'ol/source/Vector.js';
import StyleItem from '../../style/styleItem.js';
import LayerImplementation from '../layerImplementation.js';
import {
  VectorTileImplementation,
  VectorTileImplementationOptions,
} from '../vectorTileLayer.js';
import { vcsLayerName } from '../layerSymbols.js';
import type PanoramaMap from '../../map/panoramaMap.js';
import type { PanoramaImage } from '../../panorama/panoramaImage.js';
import TileProvider from '../tileProvider/tileProvider.js';
import VectorContext from '../cesium/vectorContext.js';
import {
  createSourceVectorContextSync,
  SourceVectorContextSync,
} from '../cesium/sourceVectorContextSync.js';
import VectorProperties from '../vectorProperties.js';
import { cartesianToMercator } from '../../util/math.js';
import { mercatorProjection } from '../../util/projection.js';
import Extent from '../../util/extent.js';
import { panoramaFeature } from '../../panorama/panoramaDataset.js';

export default class VectorTilePanoramaImpl
  extends LayerImplementation<PanoramaMap>
  implements VectorTileImplementation
{
  static get className(): string {
    return 'VectorTilePanoramaImpl';
  }

  private _primitiveCollection = new PrimitiveCollection();

  private _imageChangedLister: () => void;

  private _tileProvider: TileProvider;

  readonly source = new VectorSource();

  private _style: StyleItem;

  private _vectorProperties: VectorProperties;

  private _sourceVectorContextSync: SourceVectorContextSync | undefined;

  private _context: VectorContext | null = null;

  private _currentImage: PanoramaImage | undefined;

  constructor(map: PanoramaMap, options: VectorTileImplementationOptions) {
    super(map, options);

    this._primitiveCollection[vcsLayerName] = this.name;
    this._primitiveCollection.show = false;
    this._tileProvider = options.tileProvider;
    this._style = options.style;
    this._vectorProperties = options.vectorProperties;

    this._imageChangedLister = map.currentImageChanged.addEventListener(
      (image) => {
        this._setImage(image);
      },
    );
  }

  private _setImage(image?: PanoramaImage): void {
    if (image === this._currentImage) {
      return;
    }
    if (this.active) {
      this.source.clear();

      if (image) {
        const position = cartesianToMercator(image.position);
        const maxDistance = image.maxDepth ?? 50;
        const extent = [
          position[0] - maxDistance,
          position[1] - maxDistance,
          position[0] + maxDistance,
          position[1] + maxDistance,
        ];
        this._currentImage = image;
        this._tileProvider
          .getFeaturesForExtent(
            new Extent({
              coordinates: extent,
              projection: mercatorProjection.toJSON(),
            }),
          )
          .then((features) => {
            if (this._currentImage === image) {
              const excludeCurrentImage = features.filter((f) => {
                const panoramaProps = f[panoramaFeature];
                if (
                  panoramaProps?.dataset.tileProvider === this._tileProvider
                ) {
                  return panoramaProps?.name !== image.name;
                }
                return true;
              });
              this.source.addFeatures(excludeCurrentImage);
            }
          })
          .catch(() => {
            this.getLogger().warning('failed to load tiles');
          });
      }
    }
  }

  updateTiles(_tiles: string[], featureVisibility: boolean): void {
    if (!featureVisibility) {
      // do SOMETHING
    }
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._context = new VectorContext(
        this.map,
        this._primitiveCollection,
        SplitDirection.NONE,
      );
      this.map.addPrimitiveCollection(this._primitiveCollection);
      this._sourceVectorContextSync = createSourceVectorContextSync(
        this.source,
        this._context,
        this.map.getCesiumWidget().scene,
        this._style.style,
        this._vectorProperties,
      );
    }
    await super.initialize();
  }

  async activate(): Promise<void> {
    this._primitiveCollection.show = true;
    this._sourceVectorContextSync?.activate();
    await super.activate();
    this._setImage(this.map.currentPanoramaImage);
  }

  deactivate(): void {
    this._primitiveCollection.show = false;
    this._sourceVectorContextSync?.deactivate();
    super.deactivate();
  }

  updateStyle(_style: StyleItem, _silent?: boolean): void {
    this._sourceVectorContextSync?.refresh();
  }

  updateSplitDirection(_direction: SplitDirection): void {}

  destroy(): void {
    if (!this.isDestroyed) {
      if (this.map.initialized) {
        this.map.removePrimitiveCollection(this._primitiveCollection);
      } else {
        this._primitiveCollection.destroy();
      }
      this._sourceVectorContextSync?.destroy();
      this._imageChangedLister();
      this.source.clear(true);
      this.source.dispose();
    }

    super.destroy();
  }
}
