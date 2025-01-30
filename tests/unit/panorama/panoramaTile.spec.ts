import { expect } from 'chai';
import {
  getTileCoordinatesInImageExtent,
  tileCoordinateFromImageCoordinate,
} from '../../../src/panorama/panoramaTile.js';

describe.only('Panorama Tile', () => {
  describe('calculate tile coordinate from image coordinate', () => {
    it('should calculate the tile coordinate for the given image coordinate', () => {
      expect(
        tileCoordinateFromImageCoordinate([Math.PI / 2, Math.PI / 4], 1),
      ).to.have.property('key', '1/2/0');
    });
    it('should handle 0', () => {
      expect(
        tileCoordinateFromImageCoordinate([0, Math.PI / 4], 3),
      ).to.have.property('key', '3/15/2');
    });

    it('should handle 360', () => {
      expect(
        tileCoordinateFromImageCoordinate([Math.PI * 2, Math.PI / 4], 3),
      ).to.have.property('key', '3/15/2');
    });

    it('should handle close to full circle', () => {
      expect(
        tileCoordinateFromImageCoordinate(
          [Math.PI * 2 - 0.0001, Math.PI / 4],
          3,
        ),
      ).to.have.property('key', '3/0/2');
    });
  });

  describe('getting tile coordinate in image extent', () => {
    it('should return the tile coordinates in the image extent', () => {
      const keys = getTileCoordinatesInImageExtent(
        [0, 0, Math.PI / 2, Math.PI / 4],
        2,
      ).map((tc) => tc.key);
      expect(keys).to.have.lengthOf(6);
    });
  });
});
