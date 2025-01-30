import { expect } from 'chai';
import {
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  getTileSphericalCenter,
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

  describe('getting the center of a tile', () => {
    it('should get the center of the tile', () => {
      expect(
        getTileSphericalCenter({ x: 1, y: 0, level: 0, key: '0/0/0' }),
      ).to.have.ordered.members([Math.PI / 2, Math.PI / 2]);
      expect(
        getTileSphericalCenter({
          x: 15,
          y: 4,
          level: 3,
          key: '3/15/4',
        }),
      ).to.have.ordered.members([Math.PI / 16, Math.PI / 2 + Math.PI / 16]);
    });
  });

  describe('calculating a tiles distance to an image coordinate', () => {
    it('should calculate the distance to the tile', () => {
      expect(
        getDistanceToTileCoordinate([Math.PI / 2, Math.PI / 2], {
          x: 1,
          y: 0,
          level: 0,
          key: '0/0/0',
        }),
      ).to.equal(0);
    });

    it('should calculate the shortest distance around the globe', () => {
      expect(
        getDistanceToTileCoordinate(
          [Math.PI * 2 - Math.PI / 16, Math.PI / 2 + Math.PI / 16],
          {
            x: 15,
            y: 4,
            level: 3,
            key: '3/15/4',
          },
        ),
      ).to.be.closeTo(Math.PI / 8, 0.0000000001);
    });
  });
});
