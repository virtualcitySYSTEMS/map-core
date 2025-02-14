import BaseOLMap from '../baseOLMap.js';
import { getScaleFromDistance } from './cameraHelper.js';
import { ControllerInput } from './controller/controllerInput.js';

// eslint-disable-next-line import/prefer-default-export
export function moveView(
  map: BaseOLMap,
  input: ControllerInput,
  baseTranSpeed: number,
): void {
  const view = map.olMap?.getView();
  if (view) {
    if (Math.abs(input.up) > 0) {
      const zoom = view.getZoom();
      if (zoom) {
        view.setZoom(zoom - input.up * baseTranSpeed);
      }
    }

    if (Math.abs(input.forward) > 0 || Math.abs(input.right) > 0) {
      const distance = map.getViewpointSync()?.distance ?? 16;
      const scale = getScaleFromDistance(distance);
      const center = view.getCenter();
      if (center) {
        view.setCenter([
          center[0] + input.right * baseTranSpeed * scale,
          center[1] + input.forward * baseTranSpeed * scale,
        ]);
      }
    }
  }
}
