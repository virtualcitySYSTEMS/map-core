import { expect } from 'chai';
import {
  GroundPrimitive,
  Primitive,
  PrimitiveCollection,
  QuadtreeTile,
  QuadtreeTileLoadState,
  Rectangle,
  SplitDirection,
} from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom.js';
import {
  CesiumMap,
  Projection,
  StaticFeatureTileProvider,
  VcsTile,
  VcsTileState,
  VcsVectorTile,
  VectorStyleItem,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import VectorProperties from '../../../../../src/layer/vectorProperties.js';
import { timeout } from '../../../helpers/helpers.js';

describe('vcsVectorTile', () => {
  let feature: Feature;
  let tileProvider: StaticFeatureTileProvider;
  let map: CesiumMap;
  let vectorProperties: VectorProperties;
  let primitiveCollection: PrimitiveCollection;
  let style: VectorStyleItem;

  before(() => {
    map = getCesiumMap({});
    vectorProperties = new VectorProperties({});
    primitiveCollection = new PrimitiveCollection();
    style = new VectorStyleItem({
      fill: { color: '#ff0000' },
    });
    feature = new Feature({
      geometry: new Polygon([
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ].map((c) => Projection.wgs84ToMercator(c)),
      ]),
    });
    tileProvider = new StaticFeatureTileProvider({
      features: [feature],
    });
  });

  beforeEach(() => {});

  after(() => {
    vectorProperties.destroy();
    primitiveCollection.destroy();
    map.destroy();
  });

  describe('loading features', () => {
    let tile: QuadtreeTile<VcsTile>;
    let vcsTile: VcsVectorTile;

    before(() => {
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
      vcsTile = new VcsVectorTile(tile, {
        tileProvider,
        map,
        name: 'foo',
        vectorProperties,
        style: style.style,
        splitDirection: SplitDirection.NONE,
        primitiveCollection,
      });
    });

    after(() => {
      vcsTile.destroy();
    });

    it('should set the tile state to ready', () => {
      expect(vcsTile).to.have.property('state', VcsTileState.READY);
    });

    it('should add to the primitive collection', () => {
      expect(primitiveCollection.length).to.equal(1);
    });

    it('should add the feature as a primitive', () => {
      const primitive = (
        (primitiveCollection.get(0) as PrimitiveCollection).get(
          0,
        ) as PrimitiveCollection
      ).get(0) as GroundPrimitive;
      expect(primitive).to.be.instanceof(GroundPrimitive);
    });

    it('should re-calculate a feature, if it changes', async () => {
      const primitive = (
        (primitiveCollection.get(0) as PrimitiveCollection).get(
          0,
        ) as PrimitiveCollection
      ).get(0) as GroundPrimitive;
      expect(primitive).to.be.instanceof(GroundPrimitive);
      feature.changed();
      await timeout(0);
      const newPrimitive = (
        (primitiveCollection.get(0) as PrimitiveCollection).get(
          0,
        ) as PrimitiveCollection
      ).get(0) as GroundPrimitive;
      expect(newPrimitive).to.not.equal(primitive);
    });
  });

  describe('destroying the tile', () => {
    let tile: QuadtreeTile<VcsTile>;
    let vcsTile: VcsVectorTile;

    before(() => {
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
      vcsTile = new VcsVectorTile(tile, {
        tileProvider,
        map,
        name: 'foo',
        vectorProperties,
        style: style.style,
        splitDirection: SplitDirection.NONE,
        primitiveCollection,
      });
      tile.data = vcsTile;
      vcsTile.destroy();
    });

    it('should remove from the primitive collection', () => {
      expect(primitiveCollection.length).to.equal(0);
    });

    it('should remove itself from the tile', () => {
      expect(tile.data).to.be.undefined;
    });
  });
});
