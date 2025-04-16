import sinon, { type SinonSandbox } from 'sinon';
import { expect } from 'chai';
import LRUCache from 'ol/structs/LRUCache.js';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Feature from 'ol/Feature.js';
import type { TileProviderOptions } from '../../../../src/layer/tileProvider/tileProvider.js';
import TileProvider, {
  FEATURE_BY_COORDINATE_PIXEL_BUFFER,
  mercatorResolutionsToLevel,
} from '../../../../src/layer/tileProvider/tileProvider.js';
import Extent from '../../../../src/util/extent.js';
import Projection, {
  wgs84Projection,
} from '../../../../src/util/projection.js';

describe('TileProvider', () => {
  let sandbox: SinonSandbox;

  let tileProvider: TileProvider;

  before(() => {
    sandbox = sinon.createSandbox();
    tileProvider = new TileProvider({
      tileCacheSize: 1,
      baseLevels: [10, 17, 17, 14],
    });
  });

  after(() => {
    tileProvider.destroy();
  });

  describe('tileProvider creation', () => {
    it('should set the TileCacheSize', () => {
      expect(tileProvider.tileCacheSize).to.be.equal(1);
    });

    it('should remove duplicates and sort baseLevels', () => {
      expect(tileProvider.baseLevels).to.have.ordered.members([17, 14, 10]);
    });

    it('should create empty cache for each unique baseLevel', () => {
      expect(tileProvider.cache.size).to.be.equal(3);
      expect(tileProvider.cache.get(10)).to.be.an.instanceof(LRUCache);
      expect(tileProvider.cache.get(10)?.getCount()).to.be.equal(0);
      expect(tileProvider.cache.get(17)).to.be.an.instanceof(LRUCache);
      expect(tileProvider.cache.get(14)).to.be.an.instanceof(LRUCache);
    });
  });

  describe('tileCacheSize', () => {
    let tileProviderTileCache: TileProvider;

    before(() => {
      tileProviderTileCache = new TileProvider({
        tileCacheSize: 2,
        baseLevels: [10],
      });
    });

    afterEach(async () => {
      await tileProviderTileCache.clearCache();
    });

    after(() => {
      tileProviderTileCache.destroy();
    });

    it('should reduce the tileCache', async () => {
      await tileProviderTileCache.getFeaturesForTile(1, 1, 10);
      await tileProviderTileCache.getFeaturesForTile(1, 2, 10);
      expect(tileProviderTileCache.rtreeCache.size).to.be.equal(2);
      await tileProviderTileCache.setTileCacheSize(1);
      expect(tileProviderTileCache.rtreeCache.size).to.be.equal(1);
    });

    it('should extent the tileCache', async () => {
      await tileProviderTileCache.setTileCacheSize(2);
      await tileProviderTileCache.getFeaturesForTile(1, 1, 10);
      await tileProviderTileCache.getFeaturesForTile(1, 2, 10);
      await tileProviderTileCache.getFeaturesForTile(1, 3, 10);
      expect(tileProviderTileCache.rtreeCache.size).to.be.equal(2);
      await tileProviderTileCache.setTileCacheSize(3);
      await tileProviderTileCache.getFeaturesForTile(1, 1, 10);
      expect(tileProviderTileCache.rtreeCache.size).to.be.equal(3);
    });
  });

  describe('getBaseLevel', () => {
    it('should return the baseLevel if it exists', () => {
      expect(tileProvider.getBaseLevel(17)).to.be.equal(17);
      expect(tileProvider.getBaseLevel(14)).to.be.equal(14);
      expect(tileProvider.getBaseLevel(10)).to.be.equal(10);
    });

    it('should return the nearest parent if no corresponding baseLevel exist', () => {
      expect(tileProvider.getBaseLevel(18)).to.be.equal(17);
      expect(tileProvider.getBaseLevel(13)).to.be.equal(10);
    });

    it('should return undefined if no baselevel or parent baseLevel can be found', () => {
      expect(tileProvider.getBaseLevel(9)).to.be.undefined;
      expect(tileProvider.getBaseLevel(0)).to.be.undefined;
    });
  });

  describe('getBaseLevelForResolution', () => {
    it('should return the best fitting resolution for latitude 0 without correction', () => {
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[0],
          0,
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[10],
          0,
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[11],
          0,
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[13],
          0,
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[13] - 0.1,
          0,
        ),
      ).to.be.equal(14);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[20],
          0,
        ),
      ).to.be.equal(17);
    });

    it('should do a correction for the mercator latitude scale Factor ', () => {
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[13],
          CesiumMath.toRadians(45),
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[13] - 0.1,
          CesiumMath.toRadians(45),
        ),
      ).to.be.equal(10);
      expect(
        tileProvider.getBaseLevelForResolution(
          mercatorResolutionsToLevel[13] - 3,
          CesiumMath.toRadians(45),
        ),
      ).to.be.equal(14);
    });
  });

  describe('getFeaturesForTile', () => {
    let loaderSpy: sinon.SinonSpy;

    beforeEach(() => {
      loaderSpy = sandbox.spy(tileProvider, 'loader');
    });

    afterEach(async () => {
      await tileProvider.clearCache();
      sandbox.restore();
    });

    it('should forward requests to the corresponding first baseLevel', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 17);
      expect(loaderSpy).to.have.been.calledWith(1, 1, 17);
    });

    it('should use the cache for already requested tiles', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 10);
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(loaderSpy).to.have.been.calledOnce;
    });

    it('should call the loader with the corresponding nearest Parent tile', async () => {
      await tileProvider.getFeaturesForTile(500, 500, 11);
      expect(loaderSpy).to.have.been.calledWith(250, 250, 10);
      await tileProvider.getFeaturesForTile(400, 400, 16);
      expect(loaderSpy).to.have.been.calledWith(100, 100, 14);
    });

    it('should aggregate calls to the nearest ChildLevel if no parent Baselevel exists', async () => {
      await tileProvider.getFeaturesForTile(100, 100, 9);
      expect(loaderSpy.callCount).to.be.equal(4);
      expect(loaderSpy).to.have.been.calledWith(200, 200, 10);
      expect(loaderSpy).to.have.been.calledWith(201, 200, 10);
      expect(loaderSpy).to.have.been.calledWith(201, 201, 10);
      expect(loaderSpy).to.have.been.calledWith(200, 201, 10);
    });

    it('should aggregate calls up to 2 ChildLevels if no parent Baselevel exists', async () => {
      await tileProvider.getFeaturesForTile(100, 100, 8);
      expect(loaderSpy.callCount).to.be.equal(16);
      expect(loaderSpy).to.have.been.calledWith(400, 400, 10);
    });

    it('should not aggregate calls if allowTileAggregation is deactivated', async () => {
      tileProvider.allowTileAggregation = false;
      await tileProvider.getFeaturesForTile(100, 100, 8);
      expect(loaderSpy).to.not.have.been.called;
      tileProvider.allowTileAggregation = true;
    });

    it('should respect max Cache Size and unload tiles', async () => {
      await tileProvider.setTileCacheSize(1);
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.rtreeCache.has('10/1/1')).to.be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.rtreeCache.has('10/1/1')).to.be.false;
      await tileProvider.setTileCacheSize(2);
    });

    it('should load unloaded tile again', async () => {
      await tileProvider.setTileCacheSize(1);
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.rtreeCache.has('10/1/1')).to.be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.rtreeCache.has('10/1/1')).to.be.false;
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.rtreeCache.has('10/1/1')).to.be.true;
    });

    it('should fill the sourceCache', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.rtreeCache.has(tileProvider.getCacheKey(1, 1, 10))).to
        .be.true;
    });

    it('should clear unloaded Tiles from the sourceCache', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.rtreeCache.has(tileProvider.getCacheKey(1, 1, 10))).to
        .be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.rtreeCache.has(tileProvider.getCacheKey(1, 1, 10))).to
        .be.false;
    });
  });

  describe('getFeaturesForExtent', () => {
    let loaderStub: sinon.SinonStub;
    let extent: Extent;

    before(() => {
      extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [13.3, 52, 13.3005, 52.005],
      });
    });

    beforeEach(() => {
      loaderStub = sandbox.stub(tileProvider, 'loader');
      loaderStub.returns(Promise.resolve([]));
    });

    afterEach(async () => {
      await tileProvider.clearCache();
      sandbox.restore();
    });

    it('should load all the tiles for a given extent at the highest level', async () => {
      await tileProvider.getFeaturesForExtent(extent);
      expect(loaderStub).to.have.been.calledWith(70378, 43292, 17);
      expect(loaderStub).to.have.been.calledWith(70378, 43293, 17);
      expect(loaderStub).to.have.been.calledWith(70378, 43294, 17);
      expect(loaderStub).to.have.been.calledWith(70378, 43295, 17);
    });

    it('should load all tile for a given extent and level', async () => {
      await tileProvider.getFeaturesForExtent(extent, 10);
      expect(loaderStub).to.have.been.calledOnce;
      expect(loaderStub).to.have.been.calledWith(549, 338, 10);
    });

    it('should return features from the tiles, if they intersect the extent', async () => {
      const intersection = new Feature({
        geometry: new Point(Projection.wgs84ToMercator([13.3002, 52.002, 0])),
      });

      const noIntersection = new Feature({
        geometry: new Point(Projection.wgs84ToMercator([13.2, 52.1, 0])),
      });

      loaderStub.returns(Promise.resolve([intersection, noIntersection]));
      const features = await tileProvider.getFeaturesForExtent(extent, 10);
      expect(features).to.include(intersection);
      expect(features).to.not.include(noIntersection);
    });
  });

  describe('feature Handling', () => {
    let featuresTile1: Array<Feature>;
    let featuresTile2: Array<Feature>;
    let f1: Feature;
    let f2: Feature;
    let f3: Feature;
    let f4: Feature;

    before(() => {
      f1 = new Feature({
        geometry: new Point([1, 1]),
        idProp: 'idTest1',
      });
      f1.setId('id1');
      f2 = new Feature({
        geometry: new Point([1, 2]),
        idProp: 'idTest2',
      });
      f2.setId('id2');
      f3 = new Feature({
        geometry: new Point([1, 1]),
        idProp: 'idTest3',
      });
      f3.setId('id3');
      f4 = new Feature({
        geometry: new Point([1, 2]),
        idProp: 'idTest4',
      });
      f4.setId('id2');
      featuresTile1 = [f1, f2];
      featuresTile2 = [f3, f4];

      sandbox.stub(tileProvider, 'loader').callsFake((x) => {
        if (x === 1) {
          return Promise.resolve(featuresTile1);
        } else {
          return Promise.resolve(featuresTile2);
        }
      });
    });

    afterEach(async () => {
      await tileProvider.clearCache();
    });

    after(() => {
      sandbox.restore();
    });

    describe('getFeaturesForTile features', () => {
      it('should return the features', async () => {
        const requestedFeatures = await tileProvider.getFeaturesForTile(
          1,
          1,
          10,
        );
        expect(requestedFeatures).to.have.members(featuresTile1);
      });

      it('should track the featureId to the TileId', async () => {
        await tileProvider.getFeaturesForTile(1, 1, 10);
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.true;
        expect([
          ...tileProvider.featureIdToTileIds.get('id1')!,
        ]).to.have.members([tileProvider.getCacheKey(1, 1, 10)]);
      });

      it('should remove featureId from the featureTracking if the tile is unloaded', async () => {
        await tileProvider.getFeaturesForTile(1, 1, 10);
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.true;
        await tileProvider.getFeaturesForTile(2, 1, 10);
        await new Promise((res) => {
          setTimeout(res, 0);
        }); // cleanup is not synchronous.
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.false;
      });
    });

    describe('forEachFeature', () => {
      it('should call function for each feature', async () => {
        const featuresFound: Array<Feature> = [];
        await tileProvider.getFeaturesForTile(1, 1, 10);
        tileProvider.forEachFeature((feature) => {
          featuresFound.push(feature);
        });
        expect(featuresFound).to.have.members(featuresTile1);
      });
    });

    describe('larger Cache', () => {
      let tileProviderLargeCache: TileProvider;

      before(() => {
        tileProviderLargeCache = new TileProvider({
          tileCacheSize: 10,
          baseLevels: [10, 17, 17, 14],
        });

        sandbox.stub(tileProviderLargeCache, 'loader').callsFake((x) => {
          if (x === 1) {
            return Promise.resolve(featuresTile1);
          } else {
            return Promise.resolve(featuresTile2);
          }
        });
      });

      afterEach(async () => {
        await tileProviderLargeCache.clearCache();
      });

      after(() => {
        tileProviderLargeCache.destroy();
      });

      it('should collect the tileIds for features with the same ID', async () => {
        await tileProviderLargeCache.getFeaturesForTile(1, 1, 10);
        await tileProviderLargeCache.getFeaturesForTile(2, 1, 10);
        expect(tileProviderLargeCache.featureIdToTileIds.has('id1')).to.be.true;
        expect(tileProviderLargeCache.featureIdToTileIds.has('id2')).to.be.true;
        expect(tileProviderLargeCache.featureIdToTileIds.has('id3')).to.be.true;
        const tileIds = [
          tileProviderLargeCache.getCacheKey(1, 1, 10),
          tileProviderLargeCache.getCacheKey(2, 1, 10),
        ];
        expect([
          ...tileProviderLargeCache.featureIdToTileIds.get('id2')!,
        ]).to.have.members(tileIds);
      });
    });

    describe('tracking disabled', () => {
      let tileProviderWithoutTracking: TileProvider;

      before(() => {
        tileProviderWithoutTracking = new TileProvider({
          tileCacheSize: 10,
          baseLevels: [10, 17, 17, 14],
          trackFeaturesToTiles: false,
        });

        sandbox.stub(tileProviderWithoutTracking, 'loader').callsFake((x) => {
          if (x === 1) {
            return Promise.resolve(featuresTile1);
          } else {
            return Promise.resolve(featuresTile2);
          }
        });
      });

      afterEach(async () => {
        await tileProviderWithoutTracking.clearCache();
      });

      after(() => {
        tileProviderWithoutTracking.destroy();
      });

      it('should not collect FeatureIds, if trackFeaturesToTiles is deactivated', async () => {
        await tileProviderWithoutTracking.getFeaturesForTile(1, 1, 10);
        expect(tileProviderWithoutTracking.featureIdToTileIds.has('id1')).to.be
          .false;
        expect(tileProviderWithoutTracking.featureIdToTileIds.has('id2')).to.be
          .false;
      });
    });

    describe('idProperty', () => {
      let tileProviderIdProperty: TileProvider;

      before(() => {
        tileProviderIdProperty = new TileProvider({
          tileCacheSize: 10,
          baseLevels: [10, 17, 17, 14],
          idProperty: 'idProp',
        });

        sandbox.stub(tileProviderIdProperty, 'loader').callsFake((x) => {
          if (x === 1) {
            return Promise.resolve(featuresTile1);
          } else {
            return Promise.resolve(featuresTile2);
          }
        });
      });

      afterEach(async () => {
        await tileProviderIdProperty.clearCache();
      });

      after(() => {
        tileProviderIdProperty.destroy();
      });

      it('should', async () => {
        await tileProviderIdProperty.getFeaturesForTile(1, 1, 10);
        expect(tileProviderIdProperty.featureIdToTileIds.has('idTest1')).to.be
          .true;
        expect(tileProviderIdProperty.featureIdToTileIds.has('idTest2')).to.be
          .true;
      });
    });
  });

  describe('getFeaturesAtCoordinate', () => {
    let pointFeature: Feature;
    let lineFeature: Feature;
    let polygonFeature: Feature;

    before(() => {
      pointFeature = new Feature({
        geometry: new Point([3, 3]),
      });
      pointFeature.setId('point');
      lineFeature = new Feature({
        geometry: new LineString([
          [3, 0],
          [3, 1],
        ]),
      });
      lineFeature.setId('line');
      polygonFeature = new Feature({
        geometry: new Polygon([
          [
            [0, 0],
            [0, 2],
            [2, 2],
            [2, 0],
            [0, 0],
          ],
        ]),
      });
      polygonFeature.setId('polygon');
      sandbox.stub(tileProvider, 'loader').callsFake(() => {
        return Promise.resolve([pointFeature, lineFeature, polygonFeature]);
      });
    });

    afterEach(async () => {
      await tileProvider.clearCache();
    });

    after(() => {
      sandbox.restore();
    });

    it('should return exactly intersecting Point Feature', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3, 3, 0],
        0.001,
      );
      expect(features).to.have.members([pointFeature]);
    });

    it('should return the Point Feature if the coordinate is up to FEATURE_BY_COORDINATE_PIXEL_BUFFER next to it', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3 + 0.1 * FEATURE_BY_COORDINATE_PIXEL_BUFFER, 3, 0],
        0.1,
      );
      expect(features).to.have.members([pointFeature]);
    });

    it('should not return features, if its more than FEATURE_BY_COORDINATE_PIXEL_BUFFER distance', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3 + (0.1 * FEATURE_BY_COORDINATE_PIXEL_BUFFER + 0.1), 3, 0],
        0.1,
      );
      expect(features).to.be.empty;
    });

    it('should return exactly intersecting LineString Feature', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3, 0, 0],
        0.001,
      );
      expect(features).to.have.members([lineFeature]);
    });

    it('should return the Line Feature if the coordinate is up to FEATURE_BY_COORDINATE_PIXEL_BUFFER next to it', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3 + 0.1 * FEATURE_BY_COORDINATE_PIXEL_BUFFER, 0.5, 0],
        0.1,
      );
      expect(features).to.have.members([lineFeature]);
    });

    it('should not return the Line Feature if the coordinate is more than FEATURE_BY_COORDINATE_PIXEL_BUFFER next to it', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [3 + (0.1 * FEATURE_BY_COORDINATE_PIXEL_BUFFER + 0.1), 0.5, 0],
        0.1,
      );
      expect(features).to.be.empty;
    });

    it('should return intersecting Polygon Feature', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [1, 1, 0],
        0.001,
      );
      expect(features).to.have.members([polygonFeature]);
    });

    it('should not return Polygon Feature if the coordinate is not intersecting', async () => {
      const features = await tileProvider.getFeaturesByCoordinate(
        [1, 2.001, 0],
        0.001,
      );
      expect(features).to.be.empty;
    });
  });

  describe('serialization', () => {
    describe('of a default tile provider', () => {
      it('should only return type and name', () => {
        const outputConfig = new TileProvider({}).toJSON();
        expect(outputConfig).to.have.all.keys(['type', 'name']);
      });
    });

    describe('of a configured tile provider', () => {
      let inputConfig: TileProviderOptions;
      let outputConfig: TileProviderOptions;

      before(() => {
        inputConfig = {
          tileCacheSize: 40,
          baseLevels: [0, 4, 3],
          trackFeaturesToTiles: false,
          allowTileAggregation: false,
        };
        outputConfig = new TileProvider(inputConfig).toJSON();
      });

      it('should configure tileCacheSize', () => {
        expect(outputConfig).to.have.property(
          'tileCacheSize',
          inputConfig.tileCacheSize,
        );
      });

      it('should configure trackFeaturesToTiles', () => {
        expect(outputConfig).to.have.property(
          'trackFeaturesToTiles',
          inputConfig.trackFeaturesToTiles,
        );
      });

      it('should configure allowTileAggregation', () => {
        expect(outputConfig).to.have.property(
          'allowTileAggregation',
          inputConfig.allowTileAggregation,
        );
      });

      it('should configure baseLevels', () => {
        expect(outputConfig)
          .to.have.property('baseLevels')
          .and.to.have.members(inputConfig.baseLevels!);
        expect(outputConfig.baseLevels).to.not.equal(inputConfig.baseLevels);
      });
    });
  });
});
