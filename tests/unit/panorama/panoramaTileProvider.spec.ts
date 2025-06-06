import type { GeoTIFF } from 'geotiff';
import sinon from 'sinon';
import { fromFile } from 'geotiff';
import { expect } from 'chai';
import type {
  PanoramaResourceType,
  PanoramaTileProvider,
} from '../../../src/panorama/panoramaTileProvider.js';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { createPanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { createTestingDecoder } from '../helpers/panoramaHelpers.js';
import { createTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';

function tileLoadedPromise(tileProvider: PanoramaTileProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    const tileError = tileProvider.tileError.addEventListener(({ error }) => {
      reject(error);
    });

    tileProvider.loadingStateChanged.addEventListener((loading) => {
      if (!loading) {
        tileError();
        resolve();
      }
    });
  });
}

function tilesLoaded(
  tiles: PanoramaTile[],
  types: PanoramaResourceType[] = ['rgb'],
): boolean {
  return tiles.every((tile) =>
    types.every((type) => tile.material.hasTexture(type)),
  );
}

describe('PanoramaTileProvider', () => {
  let image: GeoTIFF;

  before(async () => {
    image = await fromFile('tests/data/panorama/testRgbGeotiff.tif');
  });

  after(() => {
    image.close();
  });

  describe('loading of tiles', () => {
    let panoramaImage: PanoramaImage;
    let tileProvider: PanoramaTileProvider;

    beforeEach(async () => {
      panoramaImage = await createPanoramaImage(image, {
        poolOrDecoder: createTestingDecoder(),
        providerConcurrency: 1,
        tileCacheSize: 3,
      });
      ({ tileProvider } = panoramaImage);
    });

    afterEach(() => {
      panoramaImage.destroy();
    });

    it('should load tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);

      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      expect(tiles.length).to.equal(1);
      expect(tiles[0].tileCoordinate).to.deep.equal(tileCoordinate);
      expect(tilesLoaded(tiles)).to.be.true;
    });

    it('should call loadingStateChanged', async () => {
      const spy = sinon.spy();
      const promise = new Promise<void>((resolve) => {
        tileProvider.loadingStateChanged.addEventListener((loading) => {
          spy(loading);
          if (!loading) {
            resolve();
          }
        });
      });

      const tileCoordinate = createTileCoordinate(0, 0, 0);
      tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      expect(spy).to.have.been.calledTwice;
      expect(spy.getCall(0).args[0]).to.be.true;
      expect(spy.getCall(1).args[0]).to.be.false;
    });

    it('should not re-load already loaded visible tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      const loadingAgain = sinon.spy();
      tileProvider.loadingStateChanged.addEventListener(loadingAgain);
      tileProvider.createVisibleTiles([tileCoordinate]);
      expect(loadingAgain).to.not.have.been.called;
    });

    it('should load tiles which are not yet visible', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      let tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      await promise1;
      expect(tiles).to.have.lengthOf(1);
      expect(tilesLoaded(tiles)).to.be.true;

      const otherTileCoordinate = createTileCoordinate(1, 0, 0);
      const promise2 = tileLoadedPromise(tileProvider);
      tiles = tileProvider.createVisibleTiles([
        tileCoordinate,
        otherTileCoordinate,
      ]);
      await promise2;
      expect(tiles).to.have.lengthOf(2);
      expect(tilesLoaded(tiles)).to.be.true;
    });

    it('should allow attaching to the currently running loading queue', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinates = [
        createTileCoordinate(0, 0, 1),
        createTileCoordinate(1, 0, 1),
      ];
      tileProvider.createVisibleTiles(tileCoordinates);
      const tiles = tileProvider.createVisibleTiles([
        ...tileCoordinates,
        createTileCoordinate(0, 0, 0),
      ]);
      await promise1;
      expect(tiles).to.have.lengthOf(3);
      expect(tilesLoaded(tiles)).to.be.true;
    });

    it('should load the last tile first', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinates = [
        createTileCoordinate(0, 0, 1),
        createTileCoordinate(1, 0, 1),
      ];
      const tiles = tileProvider.createVisibleTiles(tileCoordinates);
      const setTextureSpy1 = sinon.spy(tiles[0].material, 'setTexture');
      const setTextureSpy2 = sinon.spy(tiles[1].material, 'setTexture');

      await promise1;
      expect(tiles).to.have.lengthOf(2);
      expect(tilesLoaded(tiles)).to.be.true;
      expect(setTextureSpy1).to.have.been.calledOnce;
      expect(setTextureSpy2).to.have.been.calledOnce;
      expect(setTextureSpy2).to.have.been.calledBefore(setTextureSpy1);
    });
  });

  describe('loading of tiles with depth', () => {
    let depthImage: GeoTIFF;
    let panoramaImage: PanoramaImage;
    let tileProvider: PanoramaTileProvider;

    before(async () => {
      depthImage = await fromFile('tests/data/panorama/testDepthGeotiff.tif');
    });

    beforeEach(async () => {
      panoramaImage = await createPanoramaImage(image, {
        depthImage,
        poolOrDecoder: createTestingDecoder(),
        providerConcurrency: 1,
        tileCacheSize: 3,
      });
      ({ tileProvider } = panoramaImage);
    });

    afterEach(() => {
      panoramaImage.destroy();
    });

    after(() => {
      depthImage.close();
    });

    it('should load tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);

      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      expect(tiles.length).to.equal(1);
      expect(tiles[0].tileCoordinate).to.deep.equal(tileCoordinate);
      expect(tilesLoaded(tiles, ['rgb', 'depth'])).to.be.true;
    });

    it('should not re-load already loaded visible tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      const loadingAgain = sinon.spy();
      tileProvider.loadingStateChanged.addEventListener(loadingAgain);
      tileProvider.createVisibleTiles([tileCoordinate]);
      expect(loadingAgain).to.not.have.been.called;
    });

    it('should always load depth after rgb', async () => {
      const promise = tileLoadedPromise(tileProvider);

      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      const setTextureSpy = sinon.spy(tiles[0].material, 'setTexture');
      await promise;
      expect(tiles.length).to.equal(1);
      expect(setTextureSpy).to.have.been.calledTwice; // rgb and depth
      expect(setTextureSpy.getCall(0).args[0]).to.equal('rgb');
      expect(setTextureSpy.getCall(1).args[0]).to.equal('depth');
    });
  });

  describe('loading of tiles with depth & intensity', () => {
    let depthImage: GeoTIFF;
    let panoramaImage: PanoramaImage;
    let intensityImage: GeoTIFF;
    let tileProvider: PanoramaTileProvider;

    before(async () => {
      depthImage = await fromFile('tests/data/panorama/testDepthGeotiff.tif');
      intensityImage = await fromFile('tests/data/panorama/testRgbGeotiff.tif');
    });

    beforeEach(async () => {
      panoramaImage = await createPanoramaImage(image, {
        depthImage,
        intensityImage,
        poolOrDecoder: createTestingDecoder(),
        providerConcurrency: 1,
        tileCacheSize: 3,
      });
      ({ tileProvider } = panoramaImage);
      tileProvider.showIntensity = true;
      await tileProvider.intensityReady;
    });

    afterEach(() => {
      panoramaImage.destroy();
    });

    after(() => {
      depthImage.close();
      intensityImage.close();
    });

    it('should load tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);

      await promise;
      expect(tiles.length).to.equal(1);

      expect(tiles[0].tileCoordinate).to.deep.equal(tileCoordinate);
      expect(tilesLoaded(tiles, ['rgb', 'depth', 'intensity'])).to.be.true;
    });

    it('should not re-load already loaded visible tiles', async () => {
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      tileProvider.createVisibleTiles([tileCoordinate]);
      await promise;
      const loadingAgain = sinon.spy();
      tileProvider.loadingStateChanged.addEventListener(loadingAgain);
      tileProvider.createVisibleTiles([tileCoordinate]);
      expect(loadingAgain).to.not.have.been.called;
    });

    it('should always load depth after rgb', async () => {
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      const setTextureSpy = sinon.spy(tiles[0].material, 'setTexture');
      await promise;
      expect(tiles.length).to.equal(1);
      expect(setTextureSpy).to.have.been.calledThrice; // rgb, depth, intensity
      expect(setTextureSpy.getCall(0).args[0]).to.equal('rgb');
      expect(setTextureSpy.getCall(2).args[0]).to.equal('depth');
      expect(setTextureSpy.getCall(1).args[0]).to.equal('intensity');
    });

    it('should not load intensity if not requested', async () => {
      tileProvider.showIntensity = false;
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);

      await promise;
      expect(tiles.length).to.equal(1);

      expect(tiles[0].material.hasTexture('intensity')).to.be.false;
    });

    it('should load intensity on already loaded tiles', async () => {
      tileProvider.showIntensity = false;
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);

      await promise;
      const promise1 = tileLoadedPromise(tileProvider);
      tileProvider.showIntensity = true;
      await promise1;
      expect(tiles[0].material.hasTexture('intensity')).to.be.true;
    });

    it('should load intensity on tiles currently being loaded', async () => {
      tileProvider.showIntensity = false;
      const promise = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      tileProvider.showIntensity = true;
      await promise;
      expect(tiles[0].material.hasTexture('intensity')).to.be.true;
    });
  });

  describe('caching of tiles', () => {
    let panoramaImage: PanoramaImage;
    let tileProvider: PanoramaTileProvider;

    beforeEach(async () => {
      panoramaImage = await createPanoramaImage(image, {
        poolOrDecoder: createTestingDecoder(),
        providerConcurrency: 1,
        tileCacheSize: 3,
      });
      ({ tileProvider } = panoramaImage);
    });

    afterEach(() => {
      panoramaImage.destroy();
    });

    it('should cache the tiles', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinate = createTileCoordinate(0, 0, 0);
      const tiles = tileProvider.createVisibleTiles([tileCoordinate]);
      await promise1;
      expect(tiles).to.have.lengthOf(1);
      tileProvider.createVisibleTiles([]); // refresh the cache

      const tilesAgain = tileProvider.createVisibleTiles([tileCoordinate]);
      expect(tilesAgain).to.have.lengthOf(1);

      expect(tiles[0]).to.equal(tilesAgain[0]);
    });

    it('should clean the tile cache', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinates = [
        createTileCoordinate(1, 0, 1),
        createTileCoordinate(2, 0, 1),
        createTileCoordinate(3, 0, 1),
        createTileCoordinate(0, 0, 1),
      ];
      const tiles = tileProvider.createVisibleTiles(tileCoordinates);
      await promise1;
      expect(tiles).to.have.lengthOf(4);
      const promise2 = tileLoadedPromise(tileProvider);
      tileProvider.createVisibleTiles([createTileCoordinate(0, 0, 0)]);
      await promise2;

      const promise3 = tileLoadedPromise(tileProvider);
      const tilesAgain = tileProvider.createVisibleTiles([
        createTileCoordinate(1, 0, 1),
      ]);
      await promise3;

      expect(tilesAgain).to.have.lengthOf(1);

      expect(tiles[0].tileCoordinate.key).to.equal(
        tilesAgain[0].tileCoordinate.key,
      );
      expect(tiles[0]).to.not.equal(tilesAgain[0]);
    });

    it('should still keep visible tiles in the cache', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinates = [
        createTileCoordinate(1, 0, 1),
        createTileCoordinate(2, 0, 1),
        createTileCoordinate(3, 0, 1),
        createTileCoordinate(0, 0, 1),
      ];
      const tiles = tileProvider.createVisibleTiles(tileCoordinates);
      await promise1;
      expect(tiles).to.have.lengthOf(4);

      tileProvider.createVisibleTiles([]);
      const tilesAgain = tileProvider.createVisibleTiles([
        createTileCoordinate(1, 0, 1),
        createTileCoordinate(0, 0, 1),
      ]);

      expect(tilesAgain).to.have.lengthOf(2);
      expect(tiles[0]).to.equal(tilesAgain[0]);
    });

    it('should destroy tiles which get removed from the cache', async () => {
      const promise1 = tileLoadedPromise(tileProvider);
      const tileCoordinates = [
        createTileCoordinate(1, 0, 1),
        createTileCoordinate(2, 0, 1),
        createTileCoordinate(3, 0, 1),
        createTileCoordinate(0, 0, 1),
      ];
      const tiles = tileProvider.createVisibleTiles(tileCoordinates);
      await promise1;
      expect(tiles).to.have.lengthOf(4);

      const destroy = sinon.spy(tiles[0], 'destroy');
      const promise2 = tileLoadedPromise(tileProvider);
      tileProvider.createVisibleTiles([createTileCoordinate(0, 0, 0)]);
      await promise2;
      expect(destroy).to.have.been.calledOnce;
    });
  });
});
