import { expect } from 'chai';
import type { Scope } from 'nock';
import Feature from 'ol/Feature.js';
import type { FlatGeobufTileProviderOptions } from '../../../../src/layer/tileProvider/flatGeobufTileProvider.js';
import FlatGeobufTileProvider from '../../../../src/layer/tileProvider/flatGeobufTileProvider.js';
import { wgs84Projection } from '../../../../src/util/projection.js';
import { setupFgbNock } from '../../helpers/flatGeobufHelpers.js';

describe('FlatGeobufTileProvider', () => {
  let tileProvider: FlatGeobufTileProvider;
  let scope: Scope;

  before(() => {
    scope = setupFgbNock();
    tileProvider = new FlatGeobufTileProvider({
      levels: [
        {
          level: 5,
          url: 'http://localhost/wgs84Points.fgb',
        },
        {
          level: 0,
          url: 'http://localhost/wgs84Points.fgb',
        },
      ],
      projection: wgs84Projection.toJSON(),
      tileCacheSize: 10,
    });
  });

  after(() => {
    tileProvider.destroy();
    scope.done();
  });

  describe('creation', () => {
    it('should add a base level for each defined level', () => {
      expect(tileProvider.baseLevels).to.have.members([0, 5]);
    });
  });

  describe('loader of levels', () => {
    let loaded0: Feature[];
    let loaded5: Feature[];

    before(async () => {
      loaded0 = await tileProvider.loader(0, 0, 0);
      loaded5 = await tileProvider.loader(16, 15, 5);
    });

    after(async () => {
      await tileProvider.clearCache();
      scope.done();
    });

    it('should load response data', () => {
      expect(loaded0).to.have.length(2);
      expect(loaded5).to.have.length(1);
    });

    it('should create features', () => {
      expect(loaded0[0]).to.be.instanceOf(Feature);
      expect(loaded5[0]).to.be.instanceOf(Feature);
    });
  });

  describe('serialization', () => {
    describe('of a default tile provider', () => {
      it('should only return type and name', () => {
        const outputConfig = new FlatGeobufTileProvider({
          levels: [],
        }).toJSON();
        expect(outputConfig).to.have.all.keys(['type', 'name', 'levels']);
      });
    });

    describe('of a configured tile provider', () => {
      let inputConfig: FlatGeobufTileProviderOptions;
      let outputConfig: FlatGeobufTileProviderOptions;

      before(() => {
        inputConfig = {
          levels: [
            {
              level: 5,
              url: 'http://localhost/wgs84Points.fgb',
            },
            {
              level: 0,
              url: 'http://localhost/wgs84Points.fgb',
            },
          ],
          projection: wgs84Projection.toJSON(),
        };
        outputConfig = new FlatGeobufTileProvider(inputConfig).toJSON();
      });

      it('should configure levels', () => {
        expect(outputConfig)
          .to.have.property('levels')
          .and.to.eql(inputConfig.levels);
      });

      it('should configure projection', () => {
        expect(outputConfig)
          .to.have.property('projection')
          .and.to.eql(inputConfig.projection);
      });
    });
  });
});
