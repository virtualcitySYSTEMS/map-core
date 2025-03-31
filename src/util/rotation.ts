import type { JulianDate, HeadingPitchRollValues } from '@vcmap-cesium/engine';
import {
  Camera,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import Viewpoint from './viewpoint.js';
import type VcsApp from '../vcsApp.js';
import { CesiumMap } from '../../index.js';
import Projection from './projection.js';

/**
 * Unique symbol for rotation.
 * @type {symbol}
 */
export const rotationMapControlSymbol: unique symbol = Symbol(
  'rotationMapControlSymbol',
);

export type SetViewOptions = {
  destination: Cartesian3;
  orientation: HeadingPitchRollValues;
};

/**
 * Rotates the camera to a specified viewpoint.
 * @param {SetViewOptions} options - The options for setting the view.
 * @param {number} [distance] - The distance to move backward.
 * @param {CesiumMap} activeMap - The active map instance.
 */
function setUpdatedPosition(
  options: SetViewOptions,
  distance: number | undefined,
  activeMap: CesiumMap,
): void {
  let cameraPosition: Cartesian3;

  const clonedCamera = new Camera(activeMap.getCesiumWidget()!.scene);

  clonedCamera.setView(options);
  clonedCamera.moveBackward(distance);

  cameraPosition = clonedCamera.position;

  const cam = activeMap.getCesiumWidget()!.scene.camera;
  const cameraOptions = {
    heading: options.orientation.heading,
    pitch: options.orientation.pitch,
    roll: options.orientation.roll,
  };
  cameraPosition = cameraPosition || null;
  cam.cancelFlight();

  cam.setView({
    destination: cameraPosition,
    orientation: cameraOptions,
  });
}

/**
 * Rotates the center of the map.
 * @param {number} heading - The current heading of the view.
 * @param {CesiumMap} activeMap - The current Cesium Map.
 * @param {number} timePerRotation - The current rotation speed.
 * @param {JulianDate} [timeLastTick] - The time of the last tick.
 * @returns {number | undefined} The new heading.
 */
export function calculateRotation(
  heading: number,
  activeMap: CesiumMap,
  timePerRotation: number,
  timeLastTick?: JulianDate,
): number {
  let localHeading = heading;

  const { clock } = activeMap.getCesiumWidget()!;
  let timeDifference = timeLastTick
    ? clock.currentTime.secondsOfDay - timeLastTick.secondsOfDay
    : 1 / 60;
  if (timeDifference <= 0 || timeDifference > 1) {
    timeDifference = 1 / 60;
  }

  const timeFactor = timeDifference / (1 / 60);
  const headingDiff = CesiumMath.TWO_PI / ((timePerRotation * 60) / timeFactor);
  localHeading += headingDiff;
  localHeading = CesiumMath.zeroToTwoPi(localHeading);
  return localHeading;
}

/**
 * Starts the rotation of the map.
 * @param app - The VCS application instance.
 * @param [viewpoint] - The optional viewpoint to start the rotation from, if no viewpoint is provided the current Viewpoint is used.
 * @param [timePerRotation=60] - The duration of a single full rotation in seconds.
 * @returns A function to stop the rotation or null, if the rotation could not be started due to missing position.
 */
export async function startRotation(
  app: VcsApp,
  viewpoint?: Viewpoint,
  timePerRotation = 60,
): Promise<(() => void) | null> {
  const { activeMap } = app.maps;
  if (activeMap instanceof CesiumMap) {
    const scene = activeMap.getScene();
    if (scene) {
      let localViewpoint: Viewpoint | undefined;
      if (!(viewpoint instanceof Viewpoint)) {
        localViewpoint = activeMap.getViewpointSync() || undefined;
      } else {
        localViewpoint = viewpoint.clone();
      }
      if (localViewpoint) {
        if (!localViewpoint.animate) {
          localViewpoint.animate = true;

          localViewpoint.duration = 0.00000001;
        }
        app.maps.resetExclusiveMapControls();
        await activeMap.gotoViewpoint(localViewpoint);
        if (app.maps.exclusiveMapControlsId) {
          return null;
        }
        const newCenter = scene.pickPosition(
          new Cartesian2(scene.canvas.width / 2, scene.canvas.height / 2),
        );
        if (newCenter) {
          const cartographic = Cartographic.fromCartesian(newCenter);
          localViewpoint.groundPosition = [
            CesiumMath.toDegrees(cartographic.longitude),
            CesiumMath.toDegrees(cartographic.latitude),
            cartographic.height,
          ];
          localViewpoint.distance = Cartesian3.distance(
            newCenter,
            scene.camera.position,
          );
        } else {
          // we checked out the sky.
          return null;
        }

        const { distance } = localViewpoint;
        const heading = CesiumMath.toRadians(localViewpoint.heading);
        const pitch = CesiumMath.toRadians(localViewpoint.pitch);
        const roll = CesiumMath.toRadians(localViewpoint.roll);

        const groundPositionCoords = localViewpoint.groundPosition;
        if (!groundPositionCoords[2]) {
          const positions = await activeMap.getHeightFromTerrain([
            Projection.wgs84ToMercator(groundPositionCoords),
          ]);
          groundPositionCoords[2] = positions[0][2];
        }
        const groundPosition = Cartesian3.fromDegrees(
          groundPositionCoords[0],
          groundPositionCoords[1],
          groundPositionCoords[2],
        );

        const options = {
          destination: groundPosition,
          orientation: {
            heading,
            pitch,
            roll,
          },
        };

        let timeLastTick: JulianDate | undefined;
        let rotationListener: (() => void) | undefined;
        let resetMapControls: (() => void) | undefined;

        const stopRotation: () => void = () => {
          if (rotationListener) {
            rotationListener();
            rotationListener = undefined;
          }
          if (resetMapControls) {
            resetMapControls();
          }
        };

        resetMapControls = app.maps.requestExclusiveMapControls(
          { apiCalls: true, keyEvents: true, pointerEvents: true },
          stopRotation,
          rotationMapControlSymbol,
        );

        rotationListener = activeMap
          .getCesiumWidget()!
          .scene.postRender.addEventListener(() => {
            options.orientation.heading = calculateRotation(
              options.orientation.heading,
              activeMap,
              timePerRotation,
              timeLastTick,
            );

            if (options) {
              setUpdatedPosition(options, distance, activeMap);
            }

            timeLastTick = activeMap.getCesiumWidget()!.clock.currentTime;
          });

        return stopRotation;
      }
    }
  }
  return null;
}
