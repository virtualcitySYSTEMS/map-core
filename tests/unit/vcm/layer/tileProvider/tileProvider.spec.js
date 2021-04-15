import LRUCache from 'ol/structs/LRUCache.js';
import CesiumMath from 'cesium/Source/Core/Math.js';
import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import TileProvider, { mercatorResolutionsToLevel } from '../../../../../src/vcs/vcm/layer/tileProvider/tileProvider.js';
import resetFramework from '../../../helpers/resetFramework.js';

describe('vcs.vcm.layer.tileProvider.TileProvider', () => {
  let sandbox;

  /** @type {vcs.vcm.layer.tileProvider.TileProvider} */
  let tileProvider;

  before(() => {
    sandbox = sinon.createSandbox();
    tileProvider = new TileProvider({
      tileCacheSize: 1,
      baseLevels: [10, 17, 17, 14],
    });
  });

  after(() => {
    tileProvider.destroy();
    resetFramework();
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
      expect(tileProvider.cache.get(10).getCount()).to.be.equal(0);
      expect(tileProvider.cache.get(17)).to.be.an.instanceof(LRUCache);
      expect(tileProvider.cache.get(14)).to.be.an.instanceof(LRUCache);
    });
  });

  describe('tileCacheSize', () => {
    let tileProviderTileCache;

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
      expect(tileProviderTileCache.sourceCache.size).to.be.equal(2);
      await tileProviderTileCache.setTileCacheSize(1);
      expect(tileProviderTileCache.sourceCache.size).to.be.equal(1);
    });

    it('should extent the tileCache', async () => {
      await tileProviderTileCache.setTileCacheSize(2);
      await tileProviderTileCache.getFeaturesForTile(1, 1, 10);
      await tileProviderTileCache.getFeaturesForTile(1, 2, 10);
      await tileProviderTileCache.getFeaturesForTile(1, 3, 10);
      expect(tileProviderTileCache.sourceCache.size).to.be.equal(2);
      await tileProviderTileCache.setTileCacheSize(3);
      await tileProviderTileCache.getFeaturesForTile(1, 1, 10);
      expect(tileProviderTileCache.sourceCache.size).to.be.equal(3);
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
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[0], 0)).to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[10], 0)).to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[11], 0)).to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[13], 0)).to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[13] - 0.1, 0)).to.be.equal(14);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[20], 0)).to.be.equal(17);
    });
    it('should do a correction for the mercator latitude scale Factor ', () => {
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[13], CesiumMath.toRadians(45)))
        .to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[13] - 0.1, CesiumMath.toRadians(45)))
        .to.be.equal(10);
      expect(tileProvider.getBaseLevelForResolution(mercatorResolutionsToLevel[13] - 3, CesiumMath.toRadians(45)))
        .to.be.equal(14);
    });
  });

  describe('getFeaturesForTile', () => {
    let loaderSpy;

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
      expect(tileProvider.sourceCache.has('10/1/1')).to.be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.sourceCache.has('10/1/1')).to.be.false;
      await tileProvider.setTileCacheSize(2);
    });

    it('should load unloaded tile again', async () => {
      await tileProvider.setTileCacheSize(1);
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.sourceCache.has('10/1/1')).to.be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.sourceCache.has('10/1/1')).to.be.false;
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.sourceCache.has('10/1/1')).to.be.true;
    });

    it('should fill the sourceCache', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.sourceCache.has(tileProvider.getCacheKey(1, 1, 10))).to.be.true;
    });

    it('should clear unloaded Tiles from the sourceCache', async () => {
      await tileProvider.getFeaturesForTile(1, 1, 10);
      expect(tileProvider.sourceCache.has(tileProvider.getCacheKey(1, 1, 10))).to.be.true;
      await tileProvider.getFeaturesForTile(1, 2, 10);
      expect(tileProvider.sourceCache.has(tileProvider.getCacheKey(1, 1, 10))).to.be.false;
    });
  });

  describe('feature Handling', () => {
    let featuresTile1;
    let featuresTile2;
    let f1; let f2; let f3; let f4;

    before(() => {
      f1 = new Feature({ geometry: new Point([1, 1]) });
      f1.setId('id1');
      f2 = new Feature({ geometry: new Point([1, 2]) });
      f2.setId('id2');
      f3 = new Feature({ geometry: new Point([1, 1]) });
      f3.setId('id3');
      f4 = new Feature({ geometry: new Point([1, 2]) });
      f4.setId('id2');
      featuresTile1 = [f1, f2];
      featuresTile2 = [f3, f4];
      // eslint-disable-next-line no-unused-vars
      sandbox.stub(tileProvider, 'loader').callsFake((x, y, level) => {
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
        const requestedFeatures = await tileProvider.getFeaturesForTile(1, 1, 10);
        expect(requestedFeatures).to.have.members(featuresTile1);
      });

      it('should track the featureId to the TileId', async () => {
        await tileProvider.getFeaturesForTile(1, 1, 10);
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.true;
        expect([...tileProvider.featureIdToTileIds.get('id1')]).to.have.members([tileProvider.getCacheKey(1, 1, 10)]);
      });

      it('should remove featureId from the featureTracking if the tile is unloaded', async () => {
        await tileProvider.getFeaturesForTile(1, 1, 10);
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.true;
        await tileProvider.getFeaturesForTile(2, 1, 10);
        expect(tileProvider.featureIdToTileIds.has('id1')).to.be.false;
      });
    });

    describe('forEachFeature', () => {
      it('should call function for each feature', async () => {
        const featuresFound = [];
        await tileProvider.getFeaturesForTile(1, 1, 10);
        tileProvider.forEachFeature((feature) => {
          featuresFound.push(feature);
        });
        expect(featuresFound).to.have.members(featuresTile1);
      });
    });

    describe('getFeaturesAtCoordinate', () => {
      it('should return intersecting features', async () => {
        const features = await tileProvider.getFeaturesByCoordinate([1, 1, 0], 0.001);
        expect(features).to.have.members([f3]);
      });

      it('should return intersecting features, with a buffer depending on the resolution', async () => {
        const features = await tileProvider.getFeaturesByCoordinate([1, 1, 0], 2);
        expect(features).to.have.members(featuresTile2);
      });

      it('should return empty array if no intersecting features are found', async () => {
        const features = await tileProvider.getFeaturesByCoordinate([1, 4, 0], 1);
        expect(features).to.be.empty;
      });
    });

    describe('larger Cache', () => {
      let tileProviderLargeCache;

      before(() => {
        tileProviderLargeCache = new TileProvider({ tileCacheSize: 10, baseLevels: [10, 17, 17, 14] });
        // eslint-disable-next-line no-unused-vars
        sandbox.stub(tileProviderLargeCache, 'loader').callsFake((x, y, level) => {
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
        expect([...tileProviderLargeCache.featureIdToTileIds.get('id2')]).to.have.members(tileIds);
      });
    });

    describe('tracking disabled', () => {
      let tileProviderWithoutTracking;

      before(() => {
        tileProviderWithoutTracking = new TileProvider({
          tileCacheSize: 10,
          baseLevels: [10, 17, 17, 14],
          trackFeaturesToTiles: false,
        });
        // eslint-disable-next-line no-unused-vars
        sandbox.stub(tileProviderWithoutTracking, 'loader').callsFake((x, y, level) => {
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
        expect(tileProviderWithoutTracking.featureIdToTileIds.has('id1')).to.be.false;
        expect(tileProviderWithoutTracking.featureIdToTileIds.has('id2')).to.be.false;
      });
    });
  });
});
