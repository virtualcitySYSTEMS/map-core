import { expect } from 'chai';
import { getDataTiles } from '../../../../../src/layer/cesium/vcsTile/vcsTileHelpers.js';
import { TileProvider } from '../../../../../index.js';

describe('getDataTiles', () => {
  it('should only load min level, with just one base level', () => {
    const { dataLevels, dataRange } = getDataTiles(
      18,
      20,
      new TileProvider({
        baseLevels: [10],
      }),
    );
    expect([...dataLevels]).to.have.ordered.members([18]);
    expect(dataRange).to.have.ordered.members([18, 18]);
  });

  it('should extract data levels between min and max level', () => {
    const { dataLevels, dataRange } = getDataTiles(
      18,
      20,
      new TileProvider({
        baseLevels: [10, 19],
      }),
    );
    expect([...dataLevels]).to.have.ordered.members([18, 19]);
    expect(dataRange).to.have.ordered.members([18, 19]);
  });

  it('should throw, if min level is below data level', () => {
    expect(() => {
      getDataTiles(
        9,
        20,
        new TileProvider({
          baseLevels: [10, 19],
        }),
      );
    }).to.throw;
  });
});
