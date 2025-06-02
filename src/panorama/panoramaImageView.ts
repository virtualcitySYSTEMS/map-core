import type PanoramaMap from '../map/panoramaMap.js';

export type PanoramaImageView = {
  /**
   * debugging. suspend tile loading
   */
  suspendTileLoading: boolean;
  showIntensity: boolean;
  intensityOpacity: number;
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
    suspendTileLoading: false,
    showIntensity: false,
    intensityOpacity: 1,
    opacity: 1,
    destroy(): void {},
    render(): void {},
  };
}
