import { expect } from 'chai';
import { Canvas, createImageData } from 'canvas';
import type { EllipsoidGeometry, GeometryInstance } from '@vcmap-cesium/engine';
import { Cartesian2, Math as CesiumMath, Matrix4 } from '@vcmap-cesium/engine';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';
import {
  createPanoramaTile,
  createTileCoordinate,
  getDistanceToTileCoordinate,
  getTileCoordinatesInImageExtent,
  getTileSphericalCenter,
  tileCoordinateFromImageCoordinate,
} from '../../../src/panorama/panoramaTile.js';

/**
 * creates a red 4x4 image
 */
function createRedImage(): HTMLCanvasElement {
  const canvas = new Canvas(4, 4);
  const ctx = canvas.getContext('2d');

  const imageData = createImageData(
    new Uint8ClampedArray([255, 0, 0, 255]),
    4,
    4,
  );
  ctx.putImageData(imageData, 0, 0);
  return canvas as unknown as HTMLCanvasElement;
}

describe('panorama tile', () => {
  describe('tile coordinate handling', () => {
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
  });

  describe('creating a panorama tile', () => {
    let tile: PanoramaTile;

    before(() => {
      tile = createPanoramaTile(
        createTileCoordinate(1, 1, 1),
        createRedImage(),
        Matrix4.IDENTITY,
        [4, 4],
      );
    });

    after(() => {
      tile.destroy();
    });

    it('should exist', () => {
      expect(tile).to.exist;
    });

    it('should set the appearance uniforms correctly', () => {
      const materialUniforms = tile.primitive.appearance.material.uniforms as {
        image: HTMLCanvasElement;
        alpha: number;
        min: Cartesian2;
        max: Cartesian2;
      };
      expect(materialUniforms).to.have.property('min');
      expect(Cartesian2.equals(materialUniforms.min, new Cartesian2(0.25, 0)))
        .to.be.true;
      expect(materialUniforms).to.have.property('max');
      expect(Cartesian2.equals(materialUniforms.max, new Cartesian2(0.5, 0.5)))
        .to.be.true;
      expect(materialUniforms).to.have.property('image');
      expect(materialUniforms).to.have.property('alpha', 0);

      expect(materialUniforms.image).to.have.property('width', 4);
      expect(materialUniforms.image).to.have.property('height', 4);
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
  });
});
