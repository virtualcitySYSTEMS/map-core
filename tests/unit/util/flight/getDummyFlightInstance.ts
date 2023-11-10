import {
  Viewpoint,
  FlightInstance,
  anchorFromViewpoint,
  FlightAnchor,
} from '../../../../index.js';

export default function getDummyFlight(numberOfVPs = 5): FlightInstance {
  const instance = new FlightInstance({});

  for (let i = 0; i < numberOfVPs; i++) {
    const anchor = anchorFromViewpoint(
      new Viewpoint({
        cameraPosition: [i * 2, i * 2, 1],
        heading: 0,
        pitch: -45,
        roll: 0,
        duration: 1,
      }),
    );
    if (anchor) {
      instance.anchors.add(anchor);
    }
  }

  return instance;
}

export function createAnchor(): FlightAnchor {
  return anchorFromViewpoint(
    new Viewpoint({
      cameraPosition: [0, 0, 0],
    }),
  )!;
}
