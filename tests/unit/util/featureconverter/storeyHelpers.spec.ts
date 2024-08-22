import { expect } from 'chai';
import { HeightReference } from '@vcmap-cesium/engine';

import {
  getStoreyHeights,
  getStoreyOptions,
  validateStoreys,
} from '../../../../src/util/featureconverter/storeyHelpers.js';

describe('storey helpers', () => {
  describe('getStoreyHeights', () => {
    let storeyHeights: number[];

    it('should return extrudedHeight as storeyHeight Array with one entry for positive extrudedHeights', () => {
      storeyHeights = getStoreyHeights(12, [], 0);
      expect(storeyHeights).to.have.members([12]);
    });

    it('should return positive extrudedHeight as storeyHeight Array with one entry for negative extrudedHeights', () => {
      const storeyHeightsAbsolute = getStoreyHeights(-12, [], 0);
      expect(storeyHeightsAbsolute).to.have.members([12]);
    });

    it('should fill Storeyheight when no storeyHeight is given', () => {
      storeyHeights = getStoreyHeights(4, [], 2);
      expect(storeyHeights).to.have.members([2, 2]);
    });

    it('should fill up Storeyheights with latest value', () => {
      storeyHeights = getStoreyHeights(4, [2], 0);
      expect(storeyHeights).to.have.members([2, 2]);
    });

    it('should fill up Storeyheights with latest value', () => {
      storeyHeights = getStoreyHeights(7, [1, 2], 0);
      expect(storeyHeights).to.have.members([1, 2, 2, 2]);
    });

    it('should fill up the last entry of storeyheights so its sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(4, [3], 0);
      expect(storeyHeights).to.have.members([3, 1]);
    });

    it('should handle negative extrusions the same as positive extrusions', () => {
      storeyHeights = getStoreyHeights(-6, [4], 0);
      expect(storeyHeights).to.have.members([4, 2]);
    });

    it('should handle too many storeyHeights, by reducing the values so the sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(6, [4, 4, 1], 0);
      expect(storeyHeights).to.have.members([4, 2]);
    });

    it('should handle too large storeyHeights, by reducing the values so the sum equals the extrudedHeight', () => {
      storeyHeights = getStoreyHeights(6, [8, 4, 1], 0);
      expect(storeyHeights).to.have.members([6]);
    });
  });

  describe('validateStoreys', () => {
    it('should shrink storeys, and storeyHeights if more then 100 storeys', () => {
      const storeyHeights = new Array<number>(112).fill(1);
      validateStoreys(112, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(100);
    });

    it('should remove storeys, if no storeyHeights are set', () => {
      const storeyHeights: number[] = [];
      validateStoreys(2, []);
      expect(storeyHeights).to.have.lengthOf(0);
    });

    it('should remove storeyHeights, if no storeys are set', () => {
      const storeyHeights = [1, 1];
      validateStoreys(0, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(0);
    });

    it('should fill missing storeyHeights with the last value', () => {
      const storeyHeights = [1, 2];
      validateStoreys(3, storeyHeights);
      expect(storeyHeights).to.have.ordered.members([1, 2, 2]);
    });

    it('should remove excess storeys', () => {
      const storeyHeights = [1, 1];
      validateStoreys(1, storeyHeights);
      expect(storeyHeights).to.have.lengthOf(1);
    });
  });

  describe('getStoreyOptions', () => {
    it('should get the above ground storey heights', () => {
      const storeyOptions = getStoreyOptions(
        {
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 0,
          storeyHeightsAboveGround: [1, 2, 3],
          perPositionHeight: true,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        },
        20,
      );
      expect(storeyOptions.storeys).to.have.lengthOf(3);
      expect(storeyOptions.storeys).to.have.deep.members([
        { currentHeight: 20, extrudedHeight: 21 },
        { currentHeight: 21, extrudedHeight: 23 },
        { currentHeight: 23, extrudedHeight: 26 },
      ]);
    });

    it('should set the skirt level to geometry height for above ground storey heights', () => {
      const storeyOptions = getStoreyOptions(
        {
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 10,
          storeyHeightsAboveGround: [1, 2, 3],
          perPositionHeight: true,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        },
        20,
      );
      expect(storeyOptions).to.have.property('skirtLevel', 20);
    });

    it('should get the below ground storey heights', () => {
      const storeyOptions = getStoreyOptions(
        {
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 0,
          storeyHeightsBelowGround: [1, 2, 3],
          perPositionHeight: true,
          storeyHeightsAboveGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        },
        20,
      );
      expect(storeyOptions.storeys).to.have.lengthOf(3);
      expect(storeyOptions.storeys).to.have.deep.members([
        { currentHeight: 20, extrudedHeight: 19 },
        { currentHeight: 19, extrudedHeight: 17 },
        { currentHeight: 17, extrudedHeight: 14 },
      ]);
    });

    it('should set the skirt below ground storey heights', () => {
      const storeyOptions = getStoreyOptions(
        {
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 10,
          storeyHeightsBelowGround: [1, 2, 3],
          perPositionHeight: true,
          storeyHeightsAboveGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        },
        20,
      );
      expect(storeyOptions).to.have.property('skirtLevel', 14);
    });

    it('should do above & below storey heights with skirts', () => {
      const storeyOptions = getStoreyOptions(
        {
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 10,
          storeyHeightsBelowGround: [1, 2, 3],
          perPositionHeight: true,
          storeyHeightsAboveGround: [1, 2, 3],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        },
        20,
      );
      expect(storeyOptions.storeys).to.have.lengthOf(6);
      expect(storeyOptions.storeys).to.have.deep.members([
        { currentHeight: 20, extrudedHeight: 21 },
        { currentHeight: 21, extrudedHeight: 23 },
        { currentHeight: 23, extrudedHeight: 26 },
        { currentHeight: 20, extrudedHeight: 19 },
        { currentHeight: 19, extrudedHeight: 17 },
        { currentHeight: 17, extrudedHeight: 14 },
      ]);
      expect(storeyOptions).to.have.property('skirtLevel', 14);
    });
  });
});
