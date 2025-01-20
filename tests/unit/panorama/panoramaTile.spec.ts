import { expect } from 'chai';
import { tileCoordinateFromImageCoordinate } from '../../../src/panorama/panoramaTile.js';

describe.only('Panorama Tile', () => {
  describe('calculate tile coordinate from image coordinate', () => {
    it('should calculate the tile coordinate for the given image coordinate', () => {
      expect(
        tileCoordinateFromImageCoordinate([Math.PI / 2, Math.PI / 4], 1),
      ).to.have.ordered.members([1, 0, 1]);
    });
  });
});
