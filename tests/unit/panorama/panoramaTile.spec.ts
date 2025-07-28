import { expect } from 'chai';
import type { EllipsoidGeometry, GeometryInstance } from '@vcmap-cesium/engine';
import { Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createPanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import PanoramaTileMaterial from '../../../src/panorama/panoramaTileMaterial.js';

describe('panorama tile', () => {
  let tile: PanoramaTile;

  before(() => {
    tile = createPanoramaTile(
      createTileCoordinate(1, 1, 1),
      Matrix4.IDENTITY,
      [4, 4],
    );
  });

  after(() => {
    tile.destroy();
  });

  it('should create a tile', () => {
    expect(tile).to.exist;
  });

  it('should create the correct wedge geometry', () => {
    const wedgeGeometry = (
      tile.primitive.geometryInstances as GeometryInstance[]
    )[0].geometry as EllipsoidGeometry;

    expect(wedgeGeometry).to.have.property(
      '_minimumClock',
      CesiumMath.PI_OVER_TWO,
    );
    expect(wedgeGeometry).to.have.property('_maximumClock', CesiumMath.PI);
    expect(wedgeGeometry).to.have.property(
      '_minimumCone',
      CesiumMath.PI_OVER_TWO,
    );
    expect(wedgeGeometry).to.have.property('_maximumCone', CesiumMath.PI);
  });

  it('should create the tile material', () => {
    expect(tile.material).to.be.an.instanceOf(PanoramaTileMaterial);
    expect(tile.material.tileCoordinate).to.eql(tile.tileCoordinate);
  });

  describe('destruction', () => {
    let otherTile: PanoramaTile;

    before(() => {
      otherTile = createPanoramaTile(
        createTileCoordinate(2, 2, 2),
        Matrix4.IDENTITY,
        [4, 4],
      );
    });

    it('should destroy the tile and its material', () => {
      otherTile.destroy();
      expect(otherTile.material.isDestroyed()).to.be.true;
      expect(otherTile.primitive.isDestroyed()).to.be.true;
    });
  });
});
