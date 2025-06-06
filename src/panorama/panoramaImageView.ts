import { Color } from '@vcmap-cesium/engine';
import type PanoramaMap from '../map/panoramaMap.js';
import { PanoramaOverlayMode } from './panoramaTileMaterial.js';

export type PanoramaImageView = {
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  overlay: PanoramaOverlayMode;
  overlayOpacity: number;
  overlayNaNColor: Color;
  showDebug: boolean;
  opacity: number;
  destroy(): void;
  /**
   * force a render of the panorama image
   */
  render(): void;
};

/**
 * placeholder for the panorama image view.
 * @param _map
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createPanoramaImageView(_map: PanoramaMap): PanoramaImageView {
  return {
    overlay: PanoramaOverlayMode.None,
    overlayNaNColor: Color.RED,
    overlayOpacity: 0,
    showDebug: false,
    suspendTileLoading: false,
    opacity: 1,
    destroy(): void {},
    render(): void {},
  };
}
