import OLVectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import TileState from 'ol/TileState.js';
import type { Size } from 'ol/size.js';
import type VectorTile from 'ol/VectorTile.js';
import type { Feature } from 'ol';
import LayerOpenlayersImpl from './layerOpenlayersImpl.js';
import { mercatorProjection } from '../../util/projection.js';
import type {
  VectorTileImplementation,
  VectorTileImplementationOptions,
} from '../vectorTileLayer.js';
import type TileProvider from '../tileProvider/tileProvider.js';
import type Extent from '../../util/extent.js';
import type OpenlayersMap from '../../map/openlayersMap.js';
import type StyleItem from '../../style/styleItem.js';

/**
 * represents a specific vectorTileLayer for openlayers.
 */
class VectorTileOpenlayersImpl
  extends LayerOpenlayersImpl
  implements VectorTileImplementation
{
  static get className(): string {
    return 'VectorTileOpenlayersImpl';
  }

  tileProvider: TileProvider;

  source: VectorTileSource | undefined = undefined;

  tileSize: Size;

  minLevel: number | undefined;

  maxLevel: number | undefined;

  extent: Extent | undefined;

  declutter: boolean;

  constructor(map: OpenlayersMap, options: VectorTileImplementationOptions) {
    super(map, options);

    this.tileProvider = options.tileProvider;
    this.tileSize = options.tileSize;
    this.minLevel = options.minLevel;
    this.maxLevel = options.maxLevel;
    this.extent = options.extent;
    this.declutter = options.declutter;
  }

  getOLLayer(): OLVectorTileLayer {
    this.source = new VectorTileSource({
      minZoom: 0,
      maxZoom: 26,
      tileSize: this.tileSize,
      tileLoadFunction: (tile): void => {
        this.tileProvider
          .getFeaturesForTile(
            tile.tileCoord[1],
            tile.tileCoord[2],
            tile.tileCoord[0],
            this.headers,
          )
          .then((features) => {
            if (features.length > 0) {
              (tile as VectorTile<Feature>).setFeatures(features);
            } else {
              (tile as VectorTile<Feature>).setFeatures([]);
              tile.setState(TileState.EMPTY);
            }
          })
          .catch((err: unknown) => {
            this.getLogger().error((err as Error).message);
          });
      },
      // url needs to be set for the tileLoadFunction to work.
      url: '/{z}/{x}/{y}',
    });
    const extent =
      this.extent && this.extent.isValid()
        ? this.extent.getCoordinatesInProjection(mercatorProjection)
        : undefined;
    // make it so that openlayers and cesium zoom level fit together
    const minZoom = this.minLevel ? this.minLevel : undefined;
    const maxZoom = this.maxLevel ? this.maxLevel + 1 : undefined;
    const olLayer = new OLVectorTileLayer({
      visible: false,
      source: this.source,
      renderBuffer: 200,
      renderMode: 'hybrid',
      declutter: this.declutter,
      extent,
      minZoom,
      maxZoom,
    });
    return olLayer;
  }

  /**
   * refreshes the openlayers Layer, which will redraw the scene, seems to magically work
   */
  updateTiles(tileIds: string[]): void {
    if (tileIds.length > 0) {
      this.olLayer?.changed();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateStyle(_style: StyleItem, _silent?: boolean): void {
    if (this.initialized) {
      this.olLayer?.changed();
    }
  }

  setVisibility(visibility: boolean): void {
    if (this.initialized) {
      this.olLayer!.setVisible(visibility);
    }
  }

  destroy(): void {
    if (this.source) {
      this.source.clear();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.source = null;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.tileProvider = null;
    super.destroy();
  }
}

export default VectorTileOpenlayersImpl;
