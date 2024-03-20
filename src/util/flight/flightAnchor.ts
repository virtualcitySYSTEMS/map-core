import { check, is, maybe, PatternFor } from '@vcsuite/check';
import { v4 as uuidv4 } from 'uuid';
import type { Feature as GeojsonFeature, Point as GeojsonPoint } from 'geojson';
import { type Coordinate, equals as coordinateEquals } from 'ol/coordinate.js';
import VcsEvent from '../../vcsEvent.js';
import Viewpoint from '../viewpoint.js';

type FlightAnchorFeatureProperties = {
  heading: number;
  pitch: number;
  roll: number;
  duration: number;
  title?: string;
};

export type FlightAnchorGeojsonFeature = GeojsonFeature<
  GeojsonPoint,
  FlightAnchorFeatureProperties
>;

export type FlightAnchor = FlightAnchorFeatureProperties & {
  readonly changed: VcsEvent<void>;
  readonly name: string;
  coordinate: Coordinate;
  destroy(): void;
};

type FlightAnchorOptions = Omit<FlightAnchor, 'changed' | 'destroy'>;

const flightAnchorOptionsPattern: PatternFor<FlightAnchorOptions> = {
  name: String,
  coordinate: [Number],
  heading: Number,
  pitch: Number,
  roll: Number,
  duration: Number,
  title: maybe(String),
};

function isOptions(options: unknown): options is FlightAnchorOptions {
  return (
    is(options, flightAnchorOptionsPattern) && options.coordinate.length === 3
  );
}

function fromOptions(options: FlightAnchorOptions): FlightAnchor {
  check(options, flightAnchorOptionsPattern);

  const changed = new VcsEvent<void>();
  const { name } = options;
  let { title, heading, pitch, roll, coordinate, duration } = options;
  coordinate = coordinate.slice();

  return {
    get changed(): VcsEvent<void> {
      return changed;
    },
    get name(): string {
      return name;
    },
    get coordinate(): Coordinate {
      return coordinate;
    },
    set coordinate(value: Coordinate) {
      check(value, [Number]);
      check(value.length, 3);

      if (!coordinateEquals(coordinate, value)) {
        coordinate = value.slice();
        changed.raiseEvent();
      }
    },
    get heading(): number {
      return heading;
    },
    set heading(value: number) {
      check(value, Number);
      if (heading !== value) {
        heading = value;
        changed.raiseEvent();
      }
    },
    get pitch(): number {
      return pitch;
    },
    set pitch(value: number) {
      check(value, Number);
      if (pitch !== value) {
        pitch = value;
        changed.raiseEvent();
      }
    },
    get roll(): number {
      return roll;
    },
    set roll(value: number) {
      check(value, Number);
      if (roll !== value) {
        roll = value;
        changed.raiseEvent();
      }
    },
    get duration(): number {
      return duration;
    },
    set duration(value: number) {
      check(value, Number);
      if (duration !== value) {
        duration = value;
        changed.raiseEvent();
      }
    },
    get title(): string | undefined {
      return title;
    },
    set title(value: string | undefined) {
      check(value, maybe(String));

      if (title !== value) {
        title = value;
        changed.raiseEvent();
      }
    },
    destroy(): void {
      changed.destroy();
    },
  };
}

export function anchorFromViewpoint(
  viewpoint: Viewpoint,
): FlightAnchor | undefined {
  if (!viewpoint.cameraPosition) {
    return undefined;
  }

  return fromOptions({
    ...viewpoint,
    coordinate: viewpoint.cameraPosition,
    duration: viewpoint.duration ?? 1,
    title: viewpoint.properties.title as string | undefined,
  });
}

export function anchorFromGeojsonFeature(
  feature: FlightAnchorGeojsonFeature,
): FlightAnchor | undefined {
  const options = {
    ...feature.properties,
    name: feature.id ? String(feature.id) : uuidv4(),
    coordinate: feature.geometry.coordinates,
  };
  if (isOptions(options)) {
    return fromOptions(options);
  }
  return undefined;
}

export function anchorToViewpoint(anchor: FlightAnchor): Viewpoint {
  return new Viewpoint({
    name: anchor.name,
    cameraPosition: anchor.coordinate.slice(),
    heading: anchor.heading,
    pitch: anchor.pitch,
    roll: anchor.roll,
    duration: anchor.duration,
    properties: {
      title: anchor.title,
    },
  });
}

export function anchorToGeojsonFeature(
  anchor: FlightAnchor,
): FlightAnchorGeojsonFeature {
  const properties: FlightAnchorFeatureProperties = {
    heading: anchor.heading,
    pitch: anchor.pitch,
    roll: anchor.roll,
    duration: anchor.duration,
  };
  if (anchor.title) {
    properties.title = anchor.title;
  }

  return {
    type: 'Feature',
    id: anchor.name,
    geometry: {
      type: 'Point',
      coordinates: anchor.coordinate.slice(),
    },
    properties,
  };
}
