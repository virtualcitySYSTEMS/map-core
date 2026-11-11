import { expect } from 'chai';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  createTileCoordinate,
  createTileCoordinateFromKey,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  getTileSphericalCenter,
  getTileSphericalExtent,
  tileCoordinateFromImageCoordinate,
} from '../../../src/panorama/panoramaTileCoordinate.js';

describe('Panorama Tile Coordinates', () => {
  it('should calculate the correct tile coordinates', () => {
    expect(tileCoordinateFromImageCoordinate([0, 0], 0)).to.eql(
      createTileCoordinate(1, 0, 0),
    );

    expect(
      tileCoordinateFromImageCoordinate(
        [CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO, 0],
        0,
      ),
    ).to.eql(createTileCoordinate(0, 0, 0));

    expect(tileCoordinateFromImageCoordinate([0, 0], 12)).to.eql(
      createTileCoordinate(8191, 0, 12),
    );

    expect(
      tileCoordinateFromImageCoordinate(
        [CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_FOUR],
        12,
      ),
    ).to.eql(createTileCoordinate(2047, 1024, 12));
  });

  it('should the extent of a tile in image spherical coordinates', () => {
    const tileCoordinate0 = createTileCoordinate(0, 0, 0);
    const extent0 = getTileSphericalExtent(tileCoordinate0);
    expect(extent0).to.eql([
      CesiumMath.TWO_PI - CesiumMath.PI,
      0,
      CesiumMath.TWO_PI,
      CesiumMath.PI,
    ]);
  });

  it('should get the tile coordinates which touch a given extent', () => {
    const tiles0 = getTileCoordinatesInImageExtent(
      [0, 0, CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_FOUR],
      0,
    );
    expect(tiles0).to.have.lengthOf(1);

    const tiles4 = getTileCoordinatesInImageExtent(
      [0, 0, CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_FOUR],
      4,
    );
    expect(tiles4).to.have.lengthOf(45);
  });

  it('should get the center of a tile in spherical coordinates', () => {
    const tileCoordinate0 = createTileCoordinate(0, 0, 0);
    const center0 = getTileSphericalCenter(tileCoordinate0);
    expect(center0).to.eql([
      CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);

    const tileCoordinate1 = createTileCoordinate(0, 0, 1);
    const center1 = getTileSphericalCenter(tileCoordinate1);
    expect(center1).to.eql([
      CesiumMath.TWO_PI - CesiumMath.PI_OVER_FOUR,
      CesiumMath.PI_OVER_FOUR,
    ]);
  });

  it('should calculate the radial distance to a tile coordinate', () => {
    const tileCoordinate0 = createTileCoordinate(0, 0, 0);

    const distance0 = getDistanceToTileCoordinate(
      [CesiumMath.TWO_PI - CesiumMath.PI_OVER_FOUR, CesiumMath.PI_OVER_TWO],
      tileCoordinate0,
    );

    expect(distance0).to.be.closeTo(CesiumMath.PI_OVER_FOUR, 0.0001);
  });

  it('should calculate the distance to a tile across the pole on the sphere', () => {
    const position: [number, number] = [0, CesiumMath.toRadians(5)];
    // phi 168.75 and theta 11.25 degrees, on the other side of the north pole
    const acrossPole = getDistanceToTileCoordinate(
      position,
      createTileCoordinate(8, 0, 3),
    );
    // phi 11.25 and theta 56.25 degrees, on the same side as the position
    const sameSide = getDistanceToTileCoordinate(
      position,
      createTileCoordinate(15, 2, 3),
    );

    expect(acrossPole).to.be.closeTo(CesiumMath.toRadians(16.183), 0.0001);
    expect(acrossPole).to.be.lessThan(sameSide);
  });

  it('should calculate the distance to a tile across the 0 meridian on the sphere', () => {
    // the tile is at phi 348.75 and theta 33.75 degrees, 12.5 degrees across the 0 meridian
    const distance = getDistanceToTileCoordinate(
      [CesiumMath.toRadians(1.25), CesiumMath.toRadians(78.75)],
      createTileCoordinate(0, 1, 3),
    );

    expect(distance).to.be.closeTo(CesiumMath.toRadians(46.037), 0.0001);
  });

  it('should create a tile coordiante from a key', () => {
    const tileCoordinate = createTileCoordinate(0, 0, 0);
    const createdTileCoordinate = createTileCoordinateFromKey(
      tileCoordinate.key,
    );
    expect(tileCoordinate).to.deep.equal(createdTileCoordinate);
  });
});
