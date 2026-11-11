import { expect } from 'chai';
import type { FrameState } from '@vcmap-cesium/engine';
import { Cesium3DTile } from '@vcmap-cesium/engine';
import '../../../src/cesium/cesium3DTile.js';
import { isPanoramaCamera } from '../../../src/panorama/panoramaSymbols.js';

describe('Cesium3DTile getScreenSpaceError patch', () => {
  function getError(isPanorama: boolean, distanceToCamera: number): number {
    const tile = Object.create(Cesium3DTile.prototype) as Cesium3DTile;
    tile._distanceToCamera = distanceToCamera;
    (tile as unknown as Record<string, unknown>)._tileset = {
      dynamicScreenSpaceError: false,
    };
    (tile as unknown as Record<string, unknown>).geometricError = 10;
    const frameState = {
      camera: {
        frustum: { sseDenominator: 1 },
        [isPanoramaCamera]: isPanorama,
      },
      pixelRatio: 1,
      context: { drawingBufferWidth: 100, drawingBufferHeight: 100 },
    } as unknown as FrameState;
    return tile.getScreenSpaceError(frameState, false);
  }

  describe('on a panorama camera', () => {
    it('should return 0 for tiles further than 50m away', () => {
      expect(getError(true, 51)).to.equal(0);
    });

    it('should compute the original error for tiles within 50m', () => {
      expect(getError(true, 50)).to.equal(20);
    });
  });

  describe('on a regular camera', () => {
    it('should compute the original error for tiles further than 50m away', () => {
      expect(getError(false, 100)).to.equal(10);
    });
  });
});
