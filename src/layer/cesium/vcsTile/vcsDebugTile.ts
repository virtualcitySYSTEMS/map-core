import {
  PrimitiveCollection,
  QuadtreeTile,
  SplitDirection,
  TileBoundingRegion,
} from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { getCenter } from 'ol/extent.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import { Style, Text as OLText } from 'ol/style.js';
import { StyleLike } from 'ol/style/Style.js';
import VectorContext from '../vectorContext.js';
import { vcsLayerName } from '../../layerSymbols.js';
import {
  getTileBoundingRegion,
  getTileHash,
  getTileWgs84Extent,
  VcsTile,
  VcsTileOptions,
  VcsTileState,
  VcsTileType,
} from './vcsTileHelpers.js';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../../../util/projection.js';
import { createSync } from '../../vectorSymbols.js';
import VectorProperties from '../../vectorProperties.js';
import CesiumMap from '../../../map/cesiumMap.js';
import type TileProvider from '../../tileProvider/tileProvider.js';

let vectorProperties: VectorProperties | undefined;
function getDebugVectorProperties(): VectorProperties {
  if (!vectorProperties) {
    vectorProperties = new VectorProperties({});
  }
  return vectorProperties;
}

export default class VcsDebugTile implements VcsTile {
  state = VcsTileState.LOADING;

  type = VcsTileType.DEBUG;

  tileBoundingRegion: TileBoundingRegion;

  private _tile: QuadtreeTile<VcsTile>;

  private _vectorContext: VectorContext;

  private _rootCollection = new PrimitiveCollection();

  private _extentFeature: Feature | undefined;

  private _map: CesiumMap;

  private _tileProvider: TileProvider;

  private _style: StyleLike;

  private _layerPrimitiveCollection: PrimitiveCollection;

  constructor(tile: QuadtreeTile<VcsTile>, options: VcsTileOptions) {
    this._tile = tile;
    this._map = options.map;
    this._tileProvider = options.tileProvider;
    this._style = options.style;
    this._layerPrimitiveCollection = options.primitiveCollection;

    this._vectorContext = new VectorContext(
      this._map,
      this._rootCollection,
      SplitDirection.NONE,
    );
    this._rootCollection[vcsLayerName] = options.name;
    this._rootCollection.show = false;
    this._layerPrimitiveCollection.add(this._rootCollection);

    this.tileBoundingRegion = getTileBoundingRegion(tile, this._map);
    this._load().catch(() => {
      this.state = VcsTileState.FAILED;
    });
  }

  private async _load(): Promise<void> {
    this.state = VcsTileState.LOADING;
    const scene = this._map.getScene()!;
    this.state = VcsTileState.PROCESSING;

    const tileExtent = getTileWgs84Extent(
      this._tile,
      this._tileProvider.tilingScheme,
    );

    const label = new Feature({
      geometry: new Point(Projection.wgs84ToMercator(getCenter(tileExtent))),
      olcs_altitudeMode: 'relativeToGround',
      olcs_heightAboveGround: 5,
    });

    label.setStyle(
      new Style({
        text: new OLText({
          text: `${this._tile.level}/${this._tile.x}/${this._tile.y}`,
        }),
      }),
    );

    this._extentFeature = new Feature({
      geometry: fromExtent(tileExtent).transform(
        wgs84Projection.proj,
        mercatorProjection.proj,
      ),
    });
    this._extentFeature[createSync] = true;

    const features: Feature[] = [this._extentFeature, label];

    await Promise.all(
      features.map((f) => {
        return this._vectorContext.addFeature(
          f,
          f.getStyle() ?? this._style,
          getDebugVectorProperties(),
          scene,
        );
      }),
    );
    this.state = VcsTileState.READY;
  }

  get show(): boolean {
    return this._rootCollection.show;
  }

  set show(show: boolean) {
    this._rootCollection.show = show;
  }

  freeResources(): void {
    getLogger('VcsDebugTile').log(
      `freeing resources: ${getTileHash(this._tile)}`,
    );
    this.destroy();
  }

  destroy(): void {
    this._vectorContext.destroy();
    this._layerPrimitiveCollection.remove(this._rootCollection);
    this._tile.data = undefined;
  }
}
