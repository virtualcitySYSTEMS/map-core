import type { FrameState } from '@vcmap-cesium/engine';
import { Cesium3DTile } from '@vcmap-cesium/engine';
import { isPanoramaCamera } from '../panorama/panoramaSymbols.js';
import { DEFAULT_MAX_DEPTH } from '../panorama/panoramaTileProvider.js';

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalGetScreenSpaceError = Cesium3DTile.prototype.getScreenSpaceError;

Cesium3DTile.prototype.getScreenSpaceError = function getScreenSpaceError(
  frameState: FrameState,
  useParentGeometricError: boolean,
  progressiveResolutionHeightFraction?: number,
): number {
  if (
    frameState.camera[isPanoramaCamera] &&
    this._distanceToCamera > DEFAULT_MAX_DEPTH
  ) {
    return 0;
  }
  return originalGetScreenSpaceError.call(
    this,
    frameState,
    useParentGeometricError,
    progressiveResolutionHeightFraction,
  );
};
