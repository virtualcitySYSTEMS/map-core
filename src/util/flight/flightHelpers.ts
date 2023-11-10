import {
  HeadingPitchRoll,
  Cartesian3,
  Quaternion,
  CatmullRomSpline,
  LinearSpline,
  QuaternionSpline,
  Cartographic,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type {
  FeatureCollection,
  Point as GeojsonPoint,
  LineString as GeojsonLineString,
} from 'geojson';
import type { Coordinate } from 'ol/coordinate.js';
import type {
  // eslint-disable-next-line import/no-named-default
  default as FlightInstance,
  FlightInstanceMeta,
  FlightInstanceOptions,
} from './flightInstance.js';
import { vcsMetaVersion } from '../../layer/vectorProperties.js';
import { FlightAnchorGeojsonFeature } from './flightAnchor.js';

/**
 * exports a flight as GeoJson FeatureCollection
 * {Object} vcsMeta.flightOptions: flight settings
 * {Array} feature: viewpoints
 *
 * @param flightInstance
 */
export function exportFlightAsGeoJson(
  flightInstance: FlightInstance,
): FeatureCollection<GeojsonPoint> {
  const options = flightInstance.toJSON();
  const flightOptions: FlightInstanceMeta = {};
  if (options.loop != null) {
    flightOptions.loop = options.loop;
  }
  if (options.interpolation != null) {
    flightOptions.interpolation = options.interpolation;
  }
  if (options.multiplier != null) {
    flightOptions.multiplier = options.multiplier;
  }

  return {
    type: 'FeatureCollection',
    features: options.anchors ?? [],
    vcsMeta: {
      version: vcsMetaVersion,
      flightOptions: options,
    },
  };
}

export function getSplineAndTimesForInstance(flightInstance: FlightInstance): {
  destinationSpline: CatmullRomSpline | LinearSpline;
  quaternionSpline: QuaternionSpline;
  times: number[];
} {
  const { loop, anchors } = flightInstance;
  const anchorsArray = [...anchors];
  const length = loop ? anchors.size + 1 : anchors.size;
  const points = new Array(length) as Cartesian3[];
  const quaternions = new Array(length) as Quaternion[];
  const times = new Array(length) as number[];

  anchorsArray.forEach((anchor, index) => {
    points[index] = Cartesian3.fromDegrees(
      anchor.coordinate[0],
      anchor.coordinate[1],
      anchor.coordinate[2],
    );
    quaternions[index] = Quaternion.fromHeadingPitchRoll(
      HeadingPitchRoll.fromDegrees(anchor.heading, anchor.pitch, anchor.roll),
    );

    if (index > 0) {
      let previousDuration = anchorsArray[index - 1].duration;
      if (!previousDuration) {
        previousDuration =
          Cartesian3.distance(points[index - 1], points[index]) / 300 || 1;
      }
      times[index] = times[index - 1] + previousDuration;
    } else {
      times[index] = 0;
    }
  });

  if (loop) {
    points[length - 1] = Cartesian3.fromDegrees(
      anchorsArray[0].coordinate[0],
      anchorsArray[0].coordinate[1],
      anchorsArray[0].coordinate[2],
    );
    quaternions[length - 1] = Quaternion.fromHeadingPitchRoll(
      HeadingPitchRoll.fromDegrees(
        anchorsArray[0].heading,
        anchorsArray[0].pitch,
        anchorsArray[0].roll,
      ),
    );

    let loopDuration = anchorsArray[length - 2].duration;
    if (!loopDuration) {
      loopDuration =
        Cartesian3.distance(points[length - 2], points[length - 1]) / 300 || 1;
    }
    times[length - 1] = times[length - 2] + loopDuration;
  }

  const destinationSpline =
    flightInstance.interpolation === 'spline'
      ? new CatmullRomSpline({ times, points })
      : new LinearSpline({ times, points });
  const quaternionSpline = new QuaternionSpline({ times, points: quaternions });

  return {
    destinationSpline,
    quaternionSpline,
    times,
  };
}

export function getFlightPathCoordinatesFromInstance(
  flightInstance: FlightInstance,
): Coordinate[] {
  const pathCoordinates: Coordinate[] = [];

  if (flightInstance.interpolation === 'spline') {
    const { destinationSpline, times } =
      getSplineAndTimesForInstance(flightInstance);
    const scratchCartographic = new Cartographic();
    const addCoordinateFromTime = (time: number): void => {
      Cartographic.fromCartesian(
        destinationSpline.evaluate(time) as Cartesian3,
        undefined,
        scratchCartographic,
      );
      pathCoordinates.push([
        CesiumMath.toDegrees(scratchCartographic.longitude),
        CesiumMath.toDegrees(scratchCartographic.latitude),
        scratchCartographic.height,
      ]);
    };
    const endTime = times[times.length - 1];
    const step = endTime / 0.2 > 500 ? endTime / 500 : 0.2;
    for (let i = 0; i < endTime; i += step) {
      addCoordinateFromTime(i);
    }
    addCoordinateFromTime(endTime);
  } else {
    for (const anchor of flightInstance.anchors) {
      pathCoordinates.push(anchor.coordinate);
    }

    if (flightInstance.loop) {
      pathCoordinates.push(pathCoordinates[0]);
    }
  }

  return pathCoordinates;
}

export function exportFlightPathAsGeoJson(
  flightInstance: FlightInstance,
): FeatureCollection<GeojsonLineString> {
  const coordinates = getFlightPathCoordinatesFromInstance(flightInstance);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {},
      },
    ],
  };
}

/**
 * parses source and creates a flight Object
 * @param {Object} collection GeoJSON
 * containing:
 * {Object} vcsMeta containing flightOptions
 * {Array} features anchors of flightInstance
 * @returns
 */
export function parseFlightOptionsFromGeoJson(
  collection: FeatureCollection<
    GeojsonPoint,
    FlightAnchorGeojsonFeature['properties']
  >,
): FlightInstanceOptions {
  const flightOptions: Partial<FlightInstanceOptions> =
    collection.vcsMeta && collection.vcsMeta.flightOptions
      ? collection.vcsMeta.flightOptions
      : {};

  flightOptions.anchors = collection.features;
  return flightOptions;
}
