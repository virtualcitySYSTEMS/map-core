import { expect } from 'chai';
import type { EllipsoidGeometry, GeometryInstance } from '@vcmap-cesium/engine';
import { Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createPanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import PanoramaTileMaterial from '../../../src/panorama/panoramaTileMaterial.js';
import type { PanoramaMap } from '../../../index.js';
import { getPanoramaMap } from '../helpers/panoramaHelpers.js';

describe('panorama tile', () => {
  let map1: PanoramaMap;
  let map2: PanoramaMap;

  before(() => {
    map1 = getPanoramaMap();
    map2 = getPanoramaMap();
  });

  after(() => {
    map1.destroy();
    map2.destroy();
  });

  describe('creation', () => {
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
        tile.getPrimitive(map1).geometryInstances as GeometryInstance[]
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

    it('should create the correct material', () => {
      const primitive = tile.getPrimitive(map1);
      expect(tile.getMaterial(map1)).to.be.an.instanceof(PanoramaTileMaterial);
      expect(primitive.appearance.material).to.equal(tile.getMaterial(map1));
    });

    it('should cache the primitive for a map', () => {
      const primitive1 = tile.getPrimitive(map1);
      const primitive2 = tile.getPrimitive(map1);
      expect(primitive1).to.equal(primitive2);
    });

    it('should create a new primitive for a different map', () => {
      const primitive1 = tile.getPrimitive(map1);
      const primitive2 = tile.getPrimitive(map2);
      expect(primitive1).to.not.equal(primitive2);
    });
  });

  describe('getDepthAtPixel', () => {
    let depthData: Float32Array;
    let tileSize: [number, number];
    let tile: PanoramaTile;

    before(() => {
      tileSize = [4, 4];
      depthData = new Float32Array(tileSize[0] * tileSize[1]);
      for (let i = 0; i <= depthData.length; i++) {
        depthData[i] = i;
      }
    });

    beforeEach(() => {
      tile = createPanoramaTile(
        createTileCoordinate(1, 1, 1),
        Matrix4.IDENTITY,
        [4, 4],
      );
    });

    afterEach(() => {
      tile.destroy();
    });

    it('should return the normalized depth value at given pixel coordinates', () => {
      tile.setResource('depth', depthData);
      const depth = tile.getDepthAtPixel(2, 2);
      expect(depth).to.equal(10); // 2 * tileSize[0] + 2
    });

    it('should return undefined if depth data is not set', () => {
      const depth = tile.getDepthAtPixel(2, 2);
      expect(depth).to.be.undefined;
    });
  });

  describe('destruction', () => {
    let otherTile: PanoramaTile;

    beforeEach(() => {
      otherTile = createPanoramaTile(
        createTileCoordinate(2, 2, 2),
        Matrix4.IDENTITY,
        [4, 4],
      );
    });

    it('should destroy the tile primitives', () => {
      const primitive = otherTile.getPrimitive(map1);
      otherTile.destroy();
      expect(primitive.isDestroyed()).to.be.true;
    });

    it('should throw if getting a primitive after destruction', () => {
      otherTile.destroy();
      expect(() => otherTile.getPrimitive(map1)).to.throw();
    });
  });
});
