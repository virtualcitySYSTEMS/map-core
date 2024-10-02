import {
  Cartesian3,
  Event as CesiumEvent,
  FrameState,
  Intersect,
  Math as CesiumMath,
  PrimitiveCollection,
  QuadtreePrimitive,
  QuadtreeTile,
  QuadtreeTileLoadState,
  QuadtreeTileProvider,
  QuadtreeTileProviderInterface,
  SplitDirection,
  TilingScheme,
  Visibility,
} from '@vcmap-cesium/engine';
import { intersects, Extent as OLExtent } from 'ol/extent.js';
import { parseBoolean } from '@vcsuite/parsers';
import { wgs84Projection } from '../../../util/projection.js';
import {
  getDataTiles,
  getTileHash,
  getTileWgs84Extent,
  VcsTile,
  VcsTileOptions,
  VcsTileState,
  VcsTileType,
} from './vcsTileHelpers.js';
import VcsVectorTile from './vcsVectorTile.js';
import VcsNoDataTile from './vcsNoDataTile.js';
import VcsDebugTile from './vcsDebugTile.js';
import VcsChildTile from './vcsChildTile.js';
import { VectorTileImplementationOptions } from '../../vectorTileLayer.js';
import CesiumMap from '../../../map/cesiumMap.js';
import StyleItem from '../../../style/styleItem.js';

const tileDirectionScratch = new Cartesian3();

export default class VcsQuadtreeTileProvider
  implements QuadtreeTileProviderInterface
{
  // eslint-disable-next-line class-methods-use-this
  get className(): string {
    return 'VcsQuadtreeTileProvider';
  }

  quadtree: QuadtreePrimitive | undefined;

  readonly tilingScheme: TilingScheme;

  readonly errorEvent = new CesiumEvent();

  private _destroyed = false;

  private _levelZeroMaximumError: number;

  private _tileOptions: VcsTileOptions;

  private _showingTiles = new Set<string>();

  private _dataLevels: Set<number>;

  private _dataRange: [number, number];

  private _extentWgs84: OLExtent | undefined;

  private _debug = false;

  constructor(
    map: CesiumMap,
    primitiveCollection: PrimitiveCollection,
    layerOptions: VectorTileImplementationOptions,
  ) {
    this._tileOptions = {
      map,
      primitiveCollection,
      style: layerOptions.style.style,
      name: layerOptions.name,
      tileProvider: layerOptions.tileProvider,
      vectorProperties: layerOptions.vectorProperties,
      splitDirection: layerOptions.splitDirection,
    };

    this._debug = parseBoolean(layerOptions.debug, false);

    this.tilingScheme = layerOptions.tileProvider.tilingScheme;
    this._levelZeroMaximumError =
      QuadtreeTileProvider.computeDefaultLevelZeroMaximumGeometricError(
        this.tilingScheme,
      );

    const { dataLevels, dataRange } = getDataTiles(
      layerOptions.minLevel,
      layerOptions.maxLevel,
      layerOptions.tileProvider,
    );
    this._dataLevels = dataLevels;
    this._dataRange = dataRange;
    const vcsExtent = layerOptions.extent;

    if (vcsExtent?.isValid()) {
      this._extentWgs84 =
        vcsExtent?.getCoordinatesInProjection(wgs84Projection);
    }
  }

  private _withinDataRange(tile: QuadtreeTile): boolean {
    if (tile.level >= this._dataRange[0] && tile.level <= this._dataRange[1]) {
      if (this._extentWgs84) {
        const tileExtent = getTileWgs84Extent(tile, this.tilingScheme);
        return intersects(tileExtent, this._extentWgs84);
      }
      return true;
    }

    return false;
  }

  private _initializeTile(tile: QuadtreeTile<VcsTile>): void {
    if (tile.state === QuadtreeTileLoadState.START) {
      if (!tile.data) {
        if (this._withinDataRange(tile)) {
          if (this._dataLevels.has(tile.level)) {
            tile.data = this._debug
              ? new VcsDebugTile(tile, this._tileOptions)
              : new VcsVectorTile(tile, this._tileOptions);
          } else {
            tile.data = new VcsChildTile(tile, this._tileOptions.map);
          }
        } else {
          tile.data = new VcsNoDataTile(tile, this._tileOptions.map);
        }
      }

      tile.state = QuadtreeTileLoadState.LOADING;
    }
  }

  updateStyle(style: StyleItem): void {
    this._tileOptions.style = style.style;
  }

  updateSplitDirection(direction: SplitDirection): void {
    this._tileOptions.splitDirection = direction;
  }

  update(frameState: FrameState): void {
    this.quadtree?.beginFrame(frameState);
    this.quadtree?.render(frameState);
    this.quadtree?.endFrame(frameState);
  }

  endUpdate(_frameState: FrameState): void {
    this.quadtree?.forEachLoadedTile((t: QuadtreeTile<VcsTile>) => {
      if (t.data) {
        t.data.show = this._showingTiles.has(getTileHash(t));
      }
    });
    this._showingTiles.clear();
  }

  getLevelMaximumGeometricError(level: number): number {
    return this._levelZeroMaximumError / (1 << level);
  }

  loadTile(_frameState: FrameState, tile: QuadtreeTile<VcsTile>): void {
    this._initializeTile(tile);

    if (tile.data?.state === VcsTileState.READY) {
      tile.renderable = true;
      tile.state = QuadtreeTileLoadState.DONE;
    } else if (tile.data?.state === VcsTileState.FAILED) {
      tile.state = QuadtreeTileLoadState.FAILED;
    }
  }

  computeTileLoadPriority(
    tile: QuadtreeTile<VcsTile>,
    frameState: FrameState,
  ): number {
    const vcsTile = tile.data;
    if (vcsTile === undefined) {
      return 0.0;
    }

    const obb = vcsTile.tileBoundingRegion.boundingVolume;
    if (obb === undefined) {
      return 0.0;
    }

    const cameraPosition = frameState.camera.positionWC;
    const cameraDirection = frameState.camera.directionWC;
    const tileDirection = Cartesian3.subtract(
      obb.center,
      cameraPosition,
      tileDirectionScratch,
    );
    const magnitude = Cartesian3.magnitude(tileDirection);
    if (magnitude < CesiumMath.EPSILON5) {
      return 0.0;
    }
    Cartesian3.divideByScalar(tileDirection, magnitude, tileDirection);
    return (
      (1.0 - Cartesian3.dot(tileDirection, cameraDirection)) *
      // eslint-disable-next-line no-underscore-dangle
      (tile._distance ?? this.computeDistanceToTile(tile, frameState))
    );
  }

  computeTileVisibility(
    tile: QuadtreeTile<VcsTile>,
    frameState: FrameState,
  ): Visibility {
    const distance = this.computeDistanceToTile(tile, frameState);
    // eslint-disable-next-line no-underscore-dangle
    tile._distance = distance;

    if (frameState.fog) {
      if (CesiumMath.fog(distance, frameState.fog.density) >= 1.0) {
        // Tile is completely in fog so return that it is not visible.
        return Visibility.NONE;
      }
    }

    let visibility = Visibility.NONE;
    const boundingVolume = tile.data?.tileBoundingRegion.boundingVolume;
    if (boundingVolume) {
      const intersection =
        frameState.cullingVolume.computeVisibility(boundingVolume);

      if (intersection === Intersect.OUTSIDE) {
        visibility = Visibility.NONE;
      } else if (intersection === Intersect.INTERSECTING) {
        visibility = Visibility.PARTIAL;
      } else if (intersection === Intersect.INSIDE) {
        visibility = Visibility.FULL;
      }
    }

    return visibility;
  }

  // eslint-disable-next-line class-methods-use-this
  showTileThisFrame(tile: QuadtreeTile<VcsTile>): void {
    let tileToShow: QuadtreeTile<VcsTile> | undefined = tile;
    while (tileToShow?.data?.type === VcsTileType.CHILD) {
      tileToShow = tileToShow.parent;
    }

    if (tileToShow?.data) {
      this._showingTiles.add(getTileHash(tileToShow));
    }
  }

  computeDistanceToTile(
    tile: QuadtreeTile<VcsTile>,
    frameState: FrameState,
  ): number {
    this._initializeTile(tile);

    return (
      tile.data?.tileBoundingRegion.distanceToCamera(frameState) ?? 9999999999.0
    );
  }

  canRefine(tile: QuadtreeTile): boolean {
    return tile.level < this._dataRange[1];
  }

  isDestroyed(): boolean {
    return this._destroyed;
  }

  // eslint-disable-next-line class-methods-use-this
  cancelReprojections(): void {}

  // eslint-disable-next-line class-methods-use-this
  initialize(_f: FrameState): void {}

  // eslint-disable-next-line class-methods-use-this
  beginUpdate(_frameState: FrameState): void {}

  // eslint-disable-next-line class-methods-use-this
  updateForPick(_frameState: FrameState): void {}

  destroy(): void {
    this._destroyed = true;
    this._showingTiles.clear();
  }
}
