/* eslint-disable @typescript-eslint/naming-convention */
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import type { Context } from '@vcmap-cesium/engine';
import { Cartesian2, Cartesian3, Color, Material } from '@vcmap-cesium/engine';
import type { PanoramaTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import { createTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import PanoramaTileMaterial from '../../../src/panorama/panoramaTileMaterial.js';

describe('Panorama tile material', () => {
  describe('creation', () => {
    let tileCoordinate: PanoramaTileCoordinate;
    let material: PanoramaTileMaterial;

    before(() => {
      tileCoordinate = createTileCoordinate(1, 1, 1);
      material = new PanoramaTileMaterial(tileCoordinate, [4, 4]);
    });

    after(() => {
      material.destroy();
    });

    it('should set the tileCoordinate property to the provided value', () => {
      expect(material.tileCoordinate).to.eql(tileCoordinate);
    });

    it('should set u_minUV uniform based on tile coordinate and size', () => {
      expect(material.uniforms).to.have.property('u_minUV');
      expect(
        Cartesian2.equals(material.uniforms.u_minUV, new Cartesian2(0.25, 0)),
      ).to.be.true;
    });

    it('should set u_maxUV uniform based on tile coordinate and size', () => {
      expect(material.uniforms).to.have.property('u_maxUV');
      expect(
        Cartesian2.equals(material.uniforms.u_maxUV, new Cartesian2(0.5, 0.5)),
      ).to.be.true;
    });
  });

  describe('directly setting uniforms', () => {
    let material: PanoramaTileMaterial;

    before(() => {
      material = new PanoramaTileMaterial(
        createTileCoordinate(1, 1, 1),
        [4, 4],
      );
    });

    after(() => {
      material.destroy();
    });

    it('should set the overlay mode', () => {
      material.overlay = 2;
      expect(material.overlay).to.equal(2);
      expect(material.uniforms.u_overlay).to.equal(2);
    });

    it('should set the overlay opacity', () => {
      material.overlayOpacity = 0.5;
      expect(material.overlayOpacity).to.equal(0.5);
      expect(material.uniforms.u_overlayOpacity).to.equal(0.5);
    });

    it('should set the overlay NaN color', () => {
      const color = Color.BLUE;
      material.overlayNaNColor = color;
      expect(material.overlayNaNColor).to.equal(color);
      expect(material.uniforms.u_overlayNaNColor).to.equal(color);
    });

    it('should set the global opacity', () => {
      material.opacity = 0.7;
      expect(material.opacity).to.equal(0.7);
      expect(material.uniforms.u_opacity).to.equal(0.7);
    });

    it('should set the cursor position', () => {
      const pos = new Cartesian3(1, 2, 3);
      material.cursorPosition = pos;
      expect(material.cursorPosition).to.equal(pos);
      expect(material.uniforms.u_cursorPosition).to.equal(pos);
    });
  });

  describe('showDebug property', () => {
    let material: PanoramaTileMaterial;

    beforeEach(() => {
      material = new PanoramaTileMaterial(
        createTileCoordinate(1, 1, 1),
        [4, 4],
      );
    });

    afterEach(() => {
      material.destroy();
    });

    it('should enable the debug overlay when set to true', () => {
      expect(material.showDebug).to.be.false;
      material.showDebug = true;
      expect(material.showDebug).to.be.true;
      expect(material.uniforms.u_debug).to.not.equal(Material.DefaultImageId);
      expect(material.uniforms.u_debug).to.be.instanceOf(HTMLCanvasElement);
    });

    it('should not recreate the debug canvas if already set', () => {
      material.showDebug = true;
      const firstCanvas = material.uniforms.u_debug;
      material.showDebug = true;
      expect(material.uniforms.u_debug).to.equal(firstCanvas);
    });

    it('should disable the debug overlay when set to false', () => {
      material.showDebug = true;
      material.showDebug = false;
      expect(material.showDebug).to.be.false;
      expect(material.uniforms.u_debug).to.be.instanceOf(HTMLCanvasElement);
    });
  });

  describe('texture handling', () => {
    let imageBitmap: ImageBitmap;
    let tileSize: [number, number];
    let depthData: Float32Array;
    let material: PanoramaTileMaterial;

    before(async () => {
      tileSize = [4, 4];
      const canvas = document.createElement('canvas');
      canvas.width = tileSize[0];
      canvas.height = tileSize[1];
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, tileSize[0], tileSize[1]);
      imageBitmap = await global.createImageBitmap(canvas);
      depthData = new Float32Array(tileSize[0] * tileSize[1]);
    });

    beforeEach(() => {
      material = new PanoramaTileMaterial(
        createTileCoordinate(1, 1, 1),
        tileSize,
      );
    });

    afterEach(() => {
      material.destroy();
    });

    describe('setTexture', () => {
      it('should set the texture for a given resource type', () => {
        material.setTexture('rgb', imageBitmap);
        expect(material.hasTexture('rgb')).to.be.true;
        expect(material.uniforms.u_rgb).to.be.instanceOf(HTMLCanvasElement);
      });

      it('should throw if texture is set more than once for a type', () => {
        material.setTexture('rgb', imageBitmap);
        expect(() => {
          material.setTexture('rgb', imageBitmap);
        }).to.throw(/can only be set once/);
      });

      it('should store depth data for u_depth', () => {
        material.setTexture('depth', depthData);
        expect(material.hasTexture('depth')).to.be.true;
      });
    });

    describe('hasTexture', () => {
      it('should return true if a texture is set for type "rgb"', () => {
        material.setTexture('rgb', imageBitmap);
        expect(material.hasTexture('rgb')).to.be.true;
      });

      it('should return false if a texture is not set for type "rgb"', () => {
        expect(material.hasTexture('rgb')).to.be.false;
      });

      it('should return true if a texture is set for type "intensity"', () => {
        material.setTexture('intensity', imageBitmap);
        expect(material.hasTexture('intensity')).to.be.true;
      });

      it('should return false if a texture is not set for type "intensity"', () => {
        expect(material.hasTexture('intensity')).to.be.false;
      });

      it('should return true if a texture is set for type "depth"', () => {
        material.setTexture('depth', depthData);
        expect(material.hasTexture('depth')).to.be.true;
      });

      it('should return false if a texture is not set for type "depth"', () => {
        expect(material.hasTexture('depth')).to.be.false;
      });
    });
  });

  describe('getDepthAtPixel', () => {
    let depthData: Float32Array;
    let tileSize: [number, number];
    let material: PanoramaTileMaterial;

    before(() => {
      tileSize = [4, 4];
      depthData = new Float32Array(tileSize[0] * tileSize[1]);
      for (let i = 0; i <= depthData.length; i++) {
        depthData[i] = i;
      }
    });

    beforeEach(() => {
      material = new PanoramaTileMaterial(
        createTileCoordinate(1, 1, 1),
        tileSize,
      );
    });

    afterEach(() => {
      material.destroy();
    });

    it('should return the normalized depth value at given pixel coordinates', () => {
      material.setTexture('depth', depthData);
      const depth = material.getDepthAtPixel(2, 2);
      expect(depth).to.equal(10); // 2 * tileSize[0] + 2
    });

    it('should return undefined if depth data is not set', () => {
      const depth = material.getDepthAtPixel(2, 2);
      expect(depth).to.be.undefined;
    });
  });

  describe('update', () => {
    let material: PanoramaTileMaterial;
    let context: Context;
    let tileSize: [number, number];
    let depthData: Float32Array;
    let update: SinonStub;

    before(() => {
      context = { fragmentDepth: false };
      tileSize = [4, 4];
      depthData = new Float32Array(tileSize[0] * tileSize[1]);
      for (let i = 0; i < depthData.length; i++) {
        depthData[i] = i / depthData.length; // Normalize depth values
      }
      // @ts-expect-error actually private
      update = sinon.stub(Material.prototype, 'update');
    });

    beforeEach(() => {
      material = new PanoramaTileMaterial(
        createTileCoordinate(1, 1, 1),
        tileSize,
      );
    });

    afterEach(() => {
      material.destroy();
    });

    after(() => {
      update.restore();
    });

    it('should create a Texture for u_depth if depth data is present', () => {
      material.setTexture('depth', depthData);
      // this requires WebGL 2.0 or the OES_texture_float extension, wich we dont have headless.
      expect(() => {
        material.update(context);
      }).to.throw('must support the OES_texture_float extension');
    });

    it('should set u_imageReady flag if u_rgb is loaded', () => {
      (
        material as unknown as { _loadedImages: { id: string }[] }
      )._loadedImages = [{ id: 'u_rgb' }];
      material.uniforms.u_imageReady = false;
      material.update(context);
      expect(material.uniforms.u_imageReady).to.be.true;
    });

    it('should set u_intensityReady flag if u_intensity is loaded', () => {
      (
        material as unknown as { _loadedImages: { id: string }[] }
      )._loadedImages = [{ id: 'u_intensity' }];
      material.uniforms.u_intensityReady = false;
      material.update(context);
      expect(material.uniforms.u_intensityReady).to.be.true;
    });
  });
});
