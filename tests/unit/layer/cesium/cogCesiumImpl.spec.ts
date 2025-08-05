import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GeoTIFFSource from 'ol/source/GeoTIFF.js';
import { unByKey } from 'ol/Observable.js';
import { Pool, getDecoder, type BaseDecoder } from 'geotiff';
import type { ImageryLayer, ImageryTypes } from '@vcmap-cesium/engine';
import {
  type CesiumMap,
  COGCesiumImpl,
  COGLayer,
  TilingScheme,
} from '../../../../index.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

async function serveFileWithRange(filePath: string): Promise<nock.Scope> {
  const buffer = await readFile(filePath);
  const filename = path.basename(filePath);
  return nock('http://localhost')
    .get(`/${filename}`)
    .reply(function rangeReply() {
      const { range } = this.req.headers;
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
          const chunk = buffer.subarray(start, end + 1);
          return [
            206,
            chunk,
            {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Accept-Ranges': 'bytes',
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Content-Length': chunk.length,
              // eslint-disable-next-line @typescript-eslint/naming-convention
              'Content-Type': 'application/octet-stream',
            },
          ];
        }
      }
      return [
        200,
        buffer,
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Length': buffer.length,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/octet-stream',
        },
      ];
    })
    .persist();
}

function stubPoolDecode(): sinon.SinonStub {
  return sinon
    .stub(Pool.prototype, 'decode')
    .callsFake(async (fd: unknown, data: ArrayBuffer): Promise<ArrayBuffer> => {
      const decoder = (await getDecoder(fd)) as BaseDecoder;
      return decoder.decode(fd, data) as Promise<ArrayBuffer>;
    });
}

function sourceReady(source: GeoTIFFSource): Promise<void> {
  if (source.getState() === 'ready') {
    return Promise.resolve();
  } else if (source.getState() === 'error') {
    return Promise.reject(new Error('Source failed to load'));
  }

  return new Promise((resolve, reject) => {
    const key = source.on('change', () => {
      if (source.getState() === 'ready') {
        unByKey(key);
        resolve();
      } else if (source.getState() === 'error') {
        unByKey(key);
        reject(new Error('Source failed to load'));
      }
    });
  });
}

function getBandAvgs(
  canvas: HTMLCanvasElement,
): [number, number, number, number] {
  const ctx = canvas.getContext('2d');
  const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let len = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
      len += 1;
    }
  }
  const avgR = r / len;
  const avgG = g / len;
  const avgB = b / len;
  const avgA = a / len;
  return [avgR, avgG, avgB, avgA];
}

describe('cogCesiumImpl', () => {
  let layer: COGLayer;
  let map: CesiumMap;
  let poolStub: sinon.SinonStub;

  before(() => {
    layer = new COGLayer({});
    layer.tilingSchema = TilingScheme.MERCATOR;
    map = getCesiumMap();
    map.layerCollection.add(layer);
    poolStub = stubPoolDecode();
  });

  after(() => {
    map.destroy();
    layer.destroy();
    poolStub.restore();
  });

  describe('requesting images', () => {
    describe('of an aligned COG', () => {
      let impl: COGCesiumImpl;
      let imageryLayer: ImageryLayer;
      let tile: ImageryTypes | undefined;

      before(async () => {
        await serveFileWithRange('tests/data/cog/test_rgb_world.tif');
        const source = new GeoTIFFSource({
          sources: [
            {
              url: 'http://localhost/test_rgb_world.tif',
            },
          ],
          convertToRGB: 'auto',
        });
        await sourceReady(source);
        impl = new COGCesiumImpl(map, {
          ...layer.getImplementationOptions(),
          source,
        });
        imageryLayer = await impl.getCesiumLayer();
        tile = await imageryLayer.imageryProvider.requestImage(0, 0, 1);
      });

      after(() => {
        nock.cleanAll();
        impl.destroy();
      });

      it('should request the a tile', () => {
        expect(tile).to.be.ok;
      });

      it('should have a valid imagery type', () => {
        expect(tile).to.be.an.instanceof(HTMLCanvasElement);
      });

      it('should request the right image', () => {
        const [avgR, avgG, avgB, avgA] = getBandAvgs(tile as HTMLCanvasElement);
        expect(avgR).to.be.equal(44.75);
        expect(avgG).to.be.equal(44.75);
        expect(avgB).to.be.equal(44.75);
        expect(avgA).to.be.equal(255);
      });

      it('should request the right image from another tile', async () => {
        const otherTile = await imageryLayer.imageryProvider.requestImage(
          0,
          1,
          1,
        );

        const [avgR, avgG, avgB, avgA] = getBandAvgs(
          otherTile as HTMLCanvasElement,
        );
        expect(avgR).to.be.closeTo(210, 1);
        expect(avgG).to.be.closeTo(210, 1);
        expect(avgB).to.be.closeTo(210, 1);
        expect(avgA).to.be.equal(255);
      });
    });

    describe('of a grey COG', () => {
      let impl: COGCesiumImpl;
      let imageryLayer: ImageryLayer;
      let tile: ImageryTypes | undefined;

      before(async () => {
        await serveFileWithRange('tests/data/cog/test_grey_world.tif');
        const source = new GeoTIFFSource({
          sources: [
            {
              url: 'http://localhost/test_grey_world.tif',
            },
          ],
          convertToRGB: 'auto',
        });
        await sourceReady(source);
        impl = new COGCesiumImpl(map, {
          ...layer.getImplementationOptions(),
          source,
        });
        imageryLayer = await impl.getCesiumLayer();
        tile = await imageryLayer.imageryProvider.requestImage(0, 0, 1);
      });

      after(() => {
        nock.cleanAll();
        impl.destroy();
      });

      it('should request the a tile', () => {
        expect(tile).to.be.ok;
      });

      it('should have a valid imagery type', () => {
        expect(tile).to.be.an.instanceof(HTMLCanvasElement);
      });

      it('should request the right image', () => {
        const [avgR, avgG, avgB, avgA] = getBandAvgs(tile as HTMLCanvasElement);
        expect(avgR).to.be.closeTo(44.75, 1);
        expect(avgG).to.be.closeTo(44.75, 1);
        expect(avgB).to.be.closeTo(44.75, 1);
        expect(avgA).to.be.closeTo(255, 1);
      });

      it('should request the right image from another tile', async () => {
        const otherTile = await imageryLayer.imageryProvider.requestImage(
          0,
          1,
          1,
        );

        const [avgR, avgG, avgB, avgA] = getBandAvgs(
          otherTile as HTMLCanvasElement,
        );
        expect(avgR).to.be.closeTo(210, 1);
        expect(avgG).to.be.closeTo(210, 1);
        expect(avgB).to.be.closeTo(210, 1);
        expect(avgA).to.be.equal(255);
      });
    });

    describe('of an unaligned COG', () => {
      let impl: COGCesiumImpl;
      let imageryLayer: ImageryLayer;
      let tile: ImageryTypes | undefined;
      let source: GeoTIFFSource;

      before(async () => {
        await serveFileWithRange('tests/data/cog/test_rgb.tif');
        source = new GeoTIFFSource({
          sources: [
            {
              url: 'http://localhost/test_rgb.tif',
            },
          ],
          convertToRGB: 'auto',
        });
        await sourceReady(source);
        impl = new COGCesiumImpl(map, {
          ...layer.getImplementationOptions(),
          source,
        });
        imageryLayer = await impl.getCesiumLayer();
        tile = await imageryLayer.imageryProvider.requestImage(0, 0, 0);
      });

      after(() => {
        nock.cleanAll();
        impl.destroy();
      });

      it('should request the a tile', () => {
        expect(tile).to.be.ok;
      });

      it('should have a valid imagery type', () => {
        expect(tile).to.be.an.instanceof(HTMLCanvasElement);
      });

      it('should request the right image', () => {
        const [avgR, avgG, avgB, avgA] = getBandAvgs(tile as HTMLCanvasElement);
        expect(avgR).to.be.closeTo(125, 1);
        expect(avgG).to.be.closeTo(125, 1);
        expect(avgB).to.be.closeTo(125, 1);
        expect(avgA).to.be.closeTo(251, 1);
      });

      it('should request the right image from another tile', async () => {
        const otherTile = await imageryLayer.imageryProvider.requestImage(
          0,
          1,
          1,
        );

        const [avgR, avgG, avgB, avgA] = getBandAvgs(
          otherTile as HTMLCanvasElement,
        );
        expect(avgR).to.be.closeTo(60, 1);
        expect(avgG).to.be.closeTo(60, 1);
        expect(avgB).to.be.closeTo(60, 1);
        expect(avgA).to.be.closeTo(253, 1);
      });

      it('should stich tiles together correctly', async () => {
        const getTile = sinon.spy(source, 'getTile');
        await imageryLayer.imageryProvider.requestImage(0, 1, 1);
        expect(getTile.callCount).to.equal(4);
        expect(getTile.getCall(0).args.slice(0, 3)).to.have.members([2, 0, 0]);
        expect(getTile.getCall(1).args.slice(0, 3)).to.have.members([2, 0, 1]);
        expect(getTile.getCall(2).args.slice(0, 3)).to.have.members([2, 1, 0]);
        expect(getTile.getCall(3).args.slice(0, 3)).to.have.members([2, 1, 1]);
      });
    });
  });
});
