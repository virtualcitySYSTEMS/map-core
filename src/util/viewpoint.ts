import type { Coordinate } from 'ol/coordinate.js';
import { EasingFunction } from '@vcmap-cesium/engine';
import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import Projection, { wgs84Projection } from './projection.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import Extent from './extent.js';

/**
 * compares two numeric properties
 * @param  left
 * @param  right
 * @param  epsilon
 */
export function propertyEqualsEpsilon(
  left: number | undefined,
  right: number | undefined,
  epsilon: number,
): boolean {
  return left != null && right != null && Math.abs(left - right) <= epsilon;
}

/**
 * compares two angles in 360 degree range
 * @param  left angle in degree
 * @param  right angle in degree
 * @param  epsilon in degree
 */
export function angleEqualsEpsilon(
  left: number,
  right: number,
  epsilon: number,
): boolean {
  const diff = left - right - Math.trunc((left - right) / 360) * 360;
  return Math.abs(diff) <= epsilon;
}

/**
 * compares two coordinates componentwise
 * @param  left
 * @param  right
 * @param  epsilon
 */
export function coordinateEqualsEpsilon(
  left: Coordinate | undefined | null,
  right: Coordinate | undefined | null,
  epsilon: number,
): boolean {
  return (
    left != null &&
    right != null &&
    left.every((val, idx) => propertyEqualsEpsilon(val, right[idx], epsilon))
  );
}

export type ViewpointOptions = VcsObjectOptions & {
  /**
   * Z value mandatory
   */
  cameraPosition?: Coordinate;
  /**
   * Z value optional
   */
  groundPosition?: Coordinate;
  /**
   * distance between the camera position and the target
   */
  distance?: number;
  /**
   * angle between 0 and 360 degree
   */
  heading?: number;
  /**
   * angle between 0 and 360 degree
   */
  pitch?: number;
  /**
   * angle between 0 and 360 degree
   */
  roll?: number;
  /**
   * if possible the switching to the new viewpoint will be animated
   */
  animate?: boolean;
  /**
   * animation duration override
   */
  duration?: number;
  /**
   * a Cesium.EasingFunction name to use for the flight
   */
  easingFunctionName?: string;
};

export type ViewpointUrlParameters = {
  cameraPosition?: string;
  groundPosition?: string;
  epsg?: string;
  proj4?: string;
  distance?: string;
  pitch?: string;
  heading?: string;
  roll?: string;
};

/**
 * A Viewpoint Object
 * @group Viewpoint
 */
class Viewpoint extends VcsObject {
  static get className(): string {
    return 'Viewpoint';
  }

  /**
   * position of the camera (optional) (cameraPosition needs  x, y, and height value)
   * either a cameraPosition or a groundPosition have to be provided
   */
  cameraPosition: Coordinate | null;

  /**
   * groundPosition, point on the ground the camera looks at (optional)
   * either a cameraPosition or a groundPosition have to be provided
   */
  groundPosition: Coordinate | null;

  /**
   * distance between target and camera position, only needed if a groundPosition is given
   * is used to move the cameraPosition backwards to get some distance from the ground
   */
  distance: number | undefined;

  /**
   * heading, angle between 0 and 360 degree 0° = North, 90° = east ...
   */
  heading: number;

  /**
   * pitch in degrees ranges -90 to 90
   */
  pitch: number;

  /**
   * roll in degrees, ranges -90 to 90
   */
  roll: number;

  /**
   * animate this viewpoint when setting it on a map
   */
  animate: boolean;

  /**
   * An optional duration in seconds to override durations when animating this viewpoint
   */
  duration: number | undefined;

  /**
   * The name of the easing function to use
   */
  easingFunctionName: string | undefined;

  /**
   * @param  options
   */
  constructor(options: ViewpointOptions) {
    super(options);

    this.cameraPosition = null;
    if (
      Array.isArray(options.cameraPosition) &&
      options.cameraPosition.length === 3
    ) {
      this.cameraPosition = options.cameraPosition.map((c) => Number(c));
    }

    this.groundPosition = null;
    if (Array.isArray(options.groundPosition)) {
      this.groundPosition = options.groundPosition.map((c) => Number(c));
    }
    this.distance = parseNumber(
      options.distance,
      this.cameraPosition ? this.cameraPosition[2] : 1000,
    );
    this.heading = parseNumber(options.heading, 0);
    this.pitch = parseNumber(options.pitch, -90);
    this.roll = parseNumber(options.roll, 0);
    this.animate = parseBoolean(options.animate, false);
    this.duration = parseNumber(options.duration);
    this.easingFunctionName = options.easingFunctionName;
  }

  get easingFunction(): EasingFunction.Callback | null {
    return this.easingFunctionName
      ? EasingFunction[
          this.easingFunctionName as unknown as keyof typeof EasingFunction
        ]
      : null;
  }

  /**
   * @returns  returns a options object. This object can be used to reconstruct a new viewpoint
   */
  toJSON(): ViewpointOptions {
    return {
      ...super.toJSON(),
      distance: this.distance,
      cameraPosition: this.cameraPosition
        ? this.cameraPosition.slice()
        : undefined,
      groundPosition: this.groundPosition
        ? this.groundPosition.slice()
        : undefined,
      heading: this.heading,
      pitch: this.pitch,
      roll: this.roll,
      animate: this.animate,
      duration: this.duration,
      easingFunctionName: this.easingFunctionName,
    };
  }

  /**
   * clones the viewpoint
   */
  clone(): Viewpoint {
    return new Viewpoint(this.toJSON());
  }

  /**
   * creates a String representation of this viewpoint
   */
  toString(): string {
    const stringRep =
      `Viewpoint: [Ground:${String(
        this.groundPosition ? this.groundPosition : null,
      )}]` +
      `[Camera:${String(this.cameraPosition ? this.cameraPosition : null)}]` +
      `[Distance:${String(this.distance)}]` +
      `[heading:${String(this.distance)}]` +
      `[pitch:${String(this.distance)}]` +
      `[roll:${String(this.distance)}]`;
    return stringRep;
  }

  /**
   * Creates a viewpoint based on an extent
   * @param  extent
   */
  static createViewpointFromExtent(
    extent: import('ol/extent.js').Extent | Extent,
  ): Viewpoint | null {
    const extentCoordinates =
      extent instanceof Extent
        ? extent.getCoordinatesInProjection(wgs84Projection)
        : extent;

    if (extentCoordinates && extentCoordinates.length === 4) {
      const minx = extentCoordinates[0];
      const miny = extentCoordinates[1];
      const maxx = extentCoordinates[2];
      const maxy = extentCoordinates[3];

      const center = [(maxx - minx) / 2 + minx, (maxy - miny) / 2 + miny];
      let distance = 0;
      const delta = Math.max(maxx - minx, maxy - miny);
      if (delta < 0.001) {
        distance = 400;
      } else {
        distance = delta * 300000;
      }

      return new Viewpoint({
        name: 'viewpointFromExtend',
        distance,
        groundPosition: center,
        heading: 360,
        pitch: -90,
        roll: 0,
        animate: true,
      });
    }
    return null;
  }

  /**
   * creates a new Viewpoint Object from url Paramter
   * @param  urlParameter
   */
  static parseURLparameter(urlParameter: ViewpointUrlParameters): Viewpoint {
    const {
      cameraPosition: stringCameraPosition,
      groundPosition: stringGroundPosition,
    } = urlParameter;
    let cameraPosition;
    let groundPosition;
    if (stringCameraPosition != null) {
      cameraPosition = stringCameraPosition.split(',').map((c) => Number(c));
    }

    if (stringGroundPosition != null) {
      groundPosition = stringGroundPosition.split(',').map((c) => Number(c));
    }

    if (urlParameter.epsg != null) {
      const { epsg, proj4: proj4String } = urlParameter;
      const srcProjection = new Projection({ epsg, proj4: proj4String });
      const destProjection = wgs84Projection;
      if (groundPosition) {
        groundPosition = Projection.transform(
          destProjection,
          srcProjection,
          groundPosition,
        );
      }
      if (cameraPosition) {
        cameraPosition = Projection.transform(
          destProjection,
          srcProjection,
          cameraPosition,
        );
      }
    }

    const options = {
      cameraPosition,
      groundPosition,
      distance: Number(urlParameter.distance),
      pitch: Number(urlParameter.pitch),
      heading: Number(urlParameter.heading),
      roll: Number(urlParameter.roll),
    };

    return new Viewpoint(options);
  }

  /**
   * Checks if this Viewpoint is Valid
   */
  isValid(): boolean {
    const hasCamera =
      this.cameraPosition &&
      Array.isArray(this.cameraPosition) &&
      this.cameraPosition.length === 3 &&
      this.cameraPosition.every((position) => Number.isFinite(position));
    const hasGround =
      this.groundPosition &&
      Array.isArray(this.groundPosition) &&
      this.groundPosition.length > 1 &&
      this.groundPosition.length < 4 &&
      this.groundPosition.every((position) => Number.isFinite(position));
    if (!hasGround && !hasCamera) {
      return false;
    }
    if (!hasCamera && !Number.isFinite(this.distance)) {
      return false;
    }
    if (!Number.isFinite(this.heading)) {
      return false;
    }
    if (!Number.isFinite(this.pitch)) {
      return false;
    }
    if (!Number.isFinite(this.roll)) {
      return false;
    }
    return true;
  }

  /**
   * compares the provided Viewpoint with this viewpoint componentwise
   */
  equals(other: Viewpoint, epsilon = 0): boolean {
    return (
      other === this ||
      (other !== null &&
        propertyEqualsEpsilon(other.distance, this.distance, epsilon) &&
        angleEqualsEpsilon(other.heading, this.heading, epsilon) &&
        angleEqualsEpsilon(other.pitch, this.pitch, epsilon) &&
        angleEqualsEpsilon(other.roll, this.roll, epsilon) &&
        (coordinateEqualsEpsilon(
          other.cameraPosition,
          this.cameraPosition,
          epsilon,
        ) ||
          coordinateEqualsEpsilon(
            other.groundPosition,
            this.groundPosition,
            epsilon,
          )))
    );
  }
}

export default Viewpoint;
