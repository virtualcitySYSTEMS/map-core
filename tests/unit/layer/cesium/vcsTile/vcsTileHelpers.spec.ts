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

  it('should handle min and max being the same', () => {
    const { dataLevels, dataRange } = getDataTiles(
      15,
      15,
      new TileProvider({
        baseLevels: [10, 19],
      }),
    );
    expect([...dataLevels]).to.have.ordered.members([15]);
    expect(dataRange).to.have.ordered.members([15, 15]);
  });

  it('should handle min, max & base level', () => {
    const { dataLevels, dataRange } = getDataTiles(
      15,
      15,
      new TileProvider({
        baseLevels: [15],
      }),
    );
    expect([...dataLevels]).to.have.ordered.members([15]);
    expect(dataRange).to.have.ordered.members([15, 15]);
  });

  it('should handle min level being lower then a base level', () => {
    const { dataLevels, dataRange } = getDataTiles(
      12,
      18,
      new TileProvider({
        baseLevels: [15],
      }),
    );
    expect([...dataLevels]).to.have.ordered.members([15]);
    expect(dataRange).to.have.ordered.members([12, 15]);
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

  it('should throw, all levels are bellow min level', () => {
    expect(() => {
      getDataTiles(
        8,
        9,
        new TileProvider({
          baseLevels: [10, 19],
        }),
      );
    }).to.throw(Error);
  });
});
