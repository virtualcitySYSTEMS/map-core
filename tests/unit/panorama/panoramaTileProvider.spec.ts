import type { GeoTIFFImage, GeoTIFF } from 'geotiff';
import sinon from 'sinon';
import { fromFile } from 'geotiff';
import { Matrix4 } from '@vcmap-cesium/engine';
import { expect } from 'chai';
import type { PanoramaTileProvider } from '../../../src/panorama/panoramaTileProvider.js';
import { createPanoramaTileProvider } from '../../../src/panorama/panoramaTileProvider.js';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';

import { createTileCoordinate } from '../../../src/panorama/tileCoordinate.js';

type ImageSetup = {
  image: GeoTIFF;
  images: GeoTIFFImage[];
};

async function getTestImages(): Promise<ImageSetup> {
  const image = await fromFile('tests/data/panorama/testRgbGeotiff.tif');
  let imageCount = await image.getImageCount();
  const promises = [];
  while (imageCount) {
    imageCount -= 1;
    promises.push(image.getImage(imageCount));
  }
  return {
    image,
    images: await Promise.all(promises),
  };
}

function tileLoadedPromise(
  tileProvider: PanoramaTileProvider,
  tiles: PanoramaTile[] = [],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tileLoaded = tileProvider.tileLoaded.addEventListener((tile) => {
      tiles.push(tile);
    });

    const tileError = tileProvider.tileError.addEventListener(({ error }) => {
      reject(error);
    });

    tileProvider.loadingStateChanged.addEventListener((loading) => {
      if (!loading) {
        tileLoaded();
        tileError();
        resolve();
      }
    });
  });
}

describe('PanoramaTileProvider', () => {
  let tileProvider: PanoramaTileProvider;
  let images: ImageSetup;

  before(async () => {
    images = await getTestImages();
  });

  beforeEach(() => {
    tileProvider = createPanoramaTileProvider(
      images.images,
      Matrix4.IDENTITY,
      [64, 64],
      0,
      3,
      1,
      {
        decode(_fi: unknown, image: ArrayBuffer): Promise<ImageBitmap> {
          return global.createImageBitmap(new Blob([image]), 0, 0, 64, 64);
        },
      },
    );
  });

  afterEach(() => {
    tileProvider.destroy();
  });

  after(() => {
    images.image.close();
  });

  it('should load tiles', async () => {
    const tiles: PanoramaTile[] = [];
    const promise = tileLoadedPromise(tileProvider, tiles);

    const tileCoordinate = createTileCoordinate(0, 0, 0);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise;
    expect(tiles.length).to.equal(1);
    expect(tiles[0].tileCoordinate).to.deep.equal(tileCoordinate);
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
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise;
    expect(spy).to.have.been.calledTwice;
    expect(spy.getCall(0).args[0]).to.be.true;
    expect(spy.getCall(1).args[0]).to.be.false;
  });

  it('should not load already loaded visible tiles', async () => {
    const tiles: PanoramaTile[] = [];
    const promise = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinate = createTileCoordinate(0, 0, 0);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise;
    const loadingAgain = sinon.spy();
    tileProvider.loadingStateChanged.addEventListener(loadingAgain);
    tileProvider.setVisibleTiles([tileCoordinate]);
    expect(loadingAgain).to.not.have.been.called;
  });

  it('should load tiles which are not yet visible', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinate = createTileCoordinate(0, 0, 0);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise1;
    expect(tiles).to.have.lengthOf(1);

    const otherTileCoordinate = createTileCoordinate(1, 0, 0);
    const promise2 = tileLoadedPromise(tileProvider, tiles);
    tileProvider.setVisibleTiles([tileCoordinate, otherTileCoordinate]);
    await promise2;
    expect(tiles).to.have.lengthOf(2);
  });

  it('should get the currently visible tiles', async () => {
    const promise1 = tileLoadedPromise(tileProvider);
    const tileCoordinate = createTileCoordinate(0, 0, 0);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise1;
    expect(tileProvider.getVisibleTiles()).to.have.deep.members([
      tileCoordinate,
    ]);
    const otherTileCoordinate = createTileCoordinate(1, 0, 0);
    const promise2 = tileLoadedPromise(tileProvider);
    tileProvider.setVisibleTiles([tileCoordinate, otherTileCoordinate]);
    await promise2;
    expect(tileProvider.getVisibleTiles()).to.have.deep.members([
      tileCoordinate,
      otherTileCoordinate,
    ]);
  });

  it('should allow attaching to the currently running loading queue', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinates = [
      createTileCoordinate(0, 0, 1),
      createTileCoordinate(1, 0, 1),
    ];
    tileProvider.setVisibleTiles(tileCoordinates);
    tileProvider.setVisibleTiles([
      ...tileCoordinates,
      createTileCoordinate(0, 0, 0),
    ]);
    await promise1;
    expect(tiles).to.have.lengthOf(3);
  });

  it('should load the last tile first', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinates = [
      createTileCoordinate(0, 0, 1),
      createTileCoordinate(1, 0, 1),
    ];
    tileProvider.setVisibleTiles(tileCoordinates);
    await promise1;
    expect(tiles.map((t) => t.tileCoordinate.key)).to.have.ordered.members(
      tileCoordinates.reverse().map((t) => t.key),
    );
  });

  it('should cache the tiles', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinate = createTileCoordinate(0, 0, 0);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise1;
    expect(tiles).to.have.lengthOf(1);
    tileProvider.setVisibleTiles([]);

    const tilesAgain: PanoramaTile[] = [];
    const promise2 = tileLoadedPromise(tileProvider, tilesAgain);
    tileProvider.setVisibleTiles([tileCoordinate]);
    await promise2;
    expect(tilesAgain).to.have.lengthOf(1);

    expect(tiles[0]).to.equal(tilesAgain[0]);
  });

  it('should clean the tile cache', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinates = [
      createTileCoordinate(1, 0, 1),
      createTileCoordinate(2, 0, 1),
      createTileCoordinate(3, 0, 1),
      createTileCoordinate(0, 0, 1),
    ];
    tileProvider.setVisibleTiles(tileCoordinates);
    await promise1;
    expect(tiles).to.have.lengthOf(4);

    const promise2 = tileLoadedPromise(tileProvider);
    tileProvider.setVisibleTiles([createTileCoordinate(0, 0, 0)]);
    await promise2;

    const tilesAgain: PanoramaTile[] = [];
    const promise3 = tileLoadedPromise(tileProvider, tilesAgain);
    tileProvider.setVisibleTiles([createTileCoordinate(0, 0, 1)]);
    await promise3;
    expect(tilesAgain).to.have.lengthOf(1);

    expect(tiles[0].tileCoordinate.key).to.equal(
      tilesAgain[0].tileCoordinate.key,
    );
    expect(tiles[0]).to.not.equal(tilesAgain[0]);
  });

  it('should still keep visible tiles in the cache', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinates = [
      createTileCoordinate(1, 0, 1),
      createTileCoordinate(2, 0, 1),
      createTileCoordinate(3, 0, 1),
      createTileCoordinate(0, 0, 1),
    ];
    tileProvider.setVisibleTiles(tileCoordinates);
    await promise1;
    expect(tiles).to.have.lengthOf(4);

    tileProvider.setVisibleTiles([]);
    const tilesAgain: PanoramaTile[] = [];
    const promise3 = tileLoadedPromise(tileProvider, tilesAgain);
    tileProvider.setVisibleTiles([
      createTileCoordinate(0, 0, 0),
      createTileCoordinate(0, 0, 1),
    ]);
    await promise3;
    expect(tilesAgain).to.have.lengthOf(2);
    expect(tiles[0]).to.equal(tilesAgain[0]);
  });

  it('should destroy tiles which get removed from the cache', async () => {
    const tiles: PanoramaTile[] = [];
    const promise1 = tileLoadedPromise(tileProvider, tiles);
    const tileCoordinates = [
      createTileCoordinate(1, 0, 1),
      createTileCoordinate(2, 0, 1),
      createTileCoordinate(3, 0, 1),
      createTileCoordinate(0, 0, 1),
    ];
    tileProvider.setVisibleTiles(tileCoordinates);
    await promise1;
    expect(tiles).to.have.lengthOf(4);

    const destroy = sinon.spy(tiles[0], 'destroy');
    const promise2 = tileLoadedPromise(tileProvider);
    tileProvider.setVisibleTiles([createTileCoordinate(0, 0, 0)]);
    await promise2;
    expect(destroy).to.have.been.calledOnce;
  });
});
