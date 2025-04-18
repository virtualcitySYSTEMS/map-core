import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Feature from 'ol/Feature.js';
import fs from 'fs';
import nock, { ReplyFnContext, ReplyFnResult, Scope } from 'nock';
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js';
import {
  getOlFeatures,
  getValidReader,
} from '../../../src/layer/flatGeobufHelpers.js';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';
import { alreadyTransformedToMercator } from '../../../src/layer/vectorSymbols.js';
import { arrayCloseTo } from '../helpers/helpers.js';

use(chaiAsPromised);

// eslint-disable-next-line import/prefer-default-export
export function setupFgbNock(buffer?: Buffer): Scope {
  const bytes = buffer ?? fs.readFileSync('tests/data/wgs84Points.fgb');
  function cb(this: ReplyFnContext): ReplyFnResult {
    const header = this.req.headers;
    const range = header.range.split('=')?.[1].split('-').map(Number);
    range[1] = Math.min(range[1], bytes.length - 1);
    return [200, bytes.subarray(range[0], range[1] + 1)];
  }
  return nock('http://localhost').persist().get('/wgs84Points.fgb').reply(cb);
}

describe('flatGeobufHelpers', () => {
  let scope: Scope;
  before(() => {
    scope = setupFgbNock();
  });

  after(() => {
    scope.done();
  });

  describe('validating the reader', () => {
    it('should create a reader with a valid projection', async () => {
      const reader = await getValidReader(
        'http://localhost/wgs84Points.fgb',
        wgs84Projection,
      );
      expect(reader).to.exist;
    });

    it('should throw an error, if the projection codes dont add up', async () => {
      await expect(
        getValidReader('http://localhost/wgs84Points.fgb', mercatorProjection),
      ).to.eventually.be.rejected;
    });
  });

  describe('reading features within an extent', () => {
    let reader: HttpReader;

    before(async () => {
      reader = await getValidReader(
        'http://localhost/wgs84Points.fgb',
        wgs84Projection,
      );
    });

    describe('if there are features within the extent', () => {
      let features: Feature[];

      before(async () => {
        features = await getOlFeatures(
          reader,
          wgs84Projection,
          new Extent({
            coordinates: [-2, -2, 2, 2],
            projection: wgs84Projection.toJSON(),
          }),
        );
      });

      it('should return an array of features within the extent', () => {
        expect(features).to.have.lengthOf(1);
      });

      it('should set the already transformed to mercator symbol', () => {
        expect(features[0]).to.be.an.instanceOf(Feature);
        expect(features[0].getGeometry()).to.have.property(
          alreadyTransformedToMercator,
          true,
        );
      });

      it('should transrom the geometry to mercator', () => {
        expect(features[0]).to.be.an.instanceOf(Feature);
        arrayCloseTo(
          features[0].getGeometry()?.getCoordinates() ?? [],
          Projection.wgs84ToMercator([0, 1]),
        );
      });
    });

    describe('if there are no feature within the extent', () => {
      it('should return an empty array', async () => {
        const features = await getOlFeatures(
          reader,
          wgs84Projection,
          new Extent({
            coordinates: [-2, -2, -1, -1],
            projection: wgs84Projection.toJSON(),
          }),
        );
        expect(features).to.be.empty;
      });
    });
  });
});
