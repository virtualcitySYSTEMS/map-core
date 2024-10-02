import { expect } from 'chai';
import {
  CreditDisplay,
  CullingVolume,
  Fog,
  FrameState,
  PrimitiveCollection,
  QuadtreeTile,
  QuadtreeTileLoadState,
  Rectangle,
  SplitDirection,
} from '@vcmap-cesium/engine';
import {
  CesiumMap,
  FeatureVisibility,
  TileProvider,
  VcsTileType,
  VectorProperties,
  VectorStyleItem,
} from '../../../../../index.js';
import VcsQuadtreeTileProvider from '../../../../../src/layer/cesium/vcsTile/vcsQuadtreeTileProvider.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { VcsTile } from '../../../../../src/layer/cesium/vcsTile/vcsTileHelpers.js';
import { timeout } from '../../../helpers/helpers.js';

describe('VcsQuadtreeProvider', () => {
  let tileProvider: TileProvider;
  let map: CesiumMap;
  let primitiveCollection: PrimitiveCollection;
  let quadtreeTileProvider: VcsQuadtreeTileProvider;
  let frameState: FrameState;
  let tile: QuadtreeTile<VcsTile>;

  before(() => {
    tileProvider = new TileProvider({
      baseLevels: [10, 18],
    });
    map = getCesiumMap({});
    primitiveCollection = new PrimitiveCollection();
    quadtreeTileProvider = new VcsQuadtreeTileProvider(
      map,
      primitiveCollection,
      {
        declutter: false,
        featureVisibility: new FeatureVisibility(),
        maxLevel: 20,
        minLevel: 10,
        name: '',
        splitDirection: SplitDirection.NONE,
        style: new VectorStyleItem({}),
        tileSize: [256, 256],
        url: '',
        vectorProperties: new VectorProperties({}),
        tileProvider,
      },
    );
    quadtreeTileProvider.quadtree = {
      beginFrame(_f: FrameState): void {},
      endFrame(_f: FrameState): void {},
      forEachLoadedTile(cb: (tile: QuadtreeTile) => void): void {
        cb(tile);
      },
      forEachRenderedTile(cb: (tile: QuadtreeTile) => void): void {
        cb(tile);
      },
      invalidateAllTiles(): void {},
      render(_f: FrameState): void {},
    };
    frameState = {
      camera: map.getScene()!.camera,
      context: {
        fragmentDepth: false,
      },
      creditDisplay: new CreditDisplay(document.createElement('div')),
      cullingVolume: new CullingVolume(),
      fog: new Fog(),
      frameNumber: 0,
      passes: {},
    };
  });

  beforeEach(() => {
    tile = {
      children: [],
      data: undefined,
      level: 0,
      parent: undefined,
      rectangle: new Rectangle(),
      renderable: false,
      state: QuadtreeTileLoadState.START,
      tilingScheme: tileProvider.tilingScheme,
      upsampledFromParent: false,
      x: 0,
      y: 0,
    };
  });

  afterEach(() => {
    tile.data?.freeResources?.();
  });

  after(() => {
    primitiveCollection.destroy();
    map.destroy();
  });

  describe('loading tiles', () => {
    it('should load a no data tile for levels above the first data level', () => {
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile)
        .to.have.property('data')
        .and.to.have.property('type', VcsTileType.NO_DATA);
    });

    it('should load a vector tile, for a data level and set it loading', () => {
      tile.level = 10;
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile)
        .to.have.property('data')
        .and.to.have.property('type', VcsTileType.VECTOR);

      expect(tile.state).to.equal(QuadtreeTileLoadState.LOADING);
    });

    it('should load a child vector tile for in-between data levels', () => {
      tile.level = 12;
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile)
        .to.have.property('data')
        .and.to.have.property('type', VcsTileType.CHILD);
    });

    it('should set the tile done, if the data is ready', async () => {
      tile.level = 10;
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile)
        .to.have.property('data')
        .and.to.have.property('type', VcsTileType.VECTOR);

      await timeout(200);
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile.state).to.equal(QuadtreeTileLoadState.DONE);
    });
  });

  describe('showing tiles', () => {
    it('should show a vector tile on endUpdate', () => {
      tile.level = 10;
      quadtreeTileProvider.loadTile(frameState, tile);
      expect(tile)
        .to.have.property('data')
        .and.to.have.property('type', VcsTileType.VECTOR);

      quadtreeTileProvider.showTileThisFrame(tile);
      quadtreeTileProvider.endUpdate(frameState);
      expect(tile.data?.show).to.be.true;
    });

    it('should show the parent tile of a child on endUpdate', () => {
      const childTile = structuredClone(tile);
      tile.level = 10;
      quadtreeTileProvider.loadTile(frameState, tile);
      childTile.parent = tile;
      childTile.level = 11;
      quadtreeTileProvider.loadTile(frameState, childTile);

      quadtreeTileProvider.showTileThisFrame(childTile);
      quadtreeTileProvider.endUpdate(frameState);
      expect(tile.data?.show).to.be.true;
    });
  });
});
