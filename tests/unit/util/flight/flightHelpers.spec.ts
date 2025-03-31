import { LinearSpline } from '@vcmap-cesium/engine';
import { expect } from 'chai';
import getDummyFlight from './getDummyFlightInstance.js';
import { getSplineAndTimesForInstance } from '../../../../src/util/flight/flightHelpers.js';
import type { FlightInstance } from '../../../../index.js';

describe('getSplineAndTimesForInstance', () => {
  let flight: FlightInstance;

  beforeEach(() => {
    flight = getDummyFlight();
  });

  afterEach(() => {
    flight.destroy();
  });

  it('should create a linear spline, if the flights interpolation method is not SPLINE', () => {
    flight.interpolation = 'linear';
    const { destinationSpline } = getSplineAndTimesForInstance(flight);
    expect(destinationSpline).to.be.an.instanceOf(LinearSpline);
  });

  it('should set the times based on the viewpoint durations', () => {
    [...flight.anchors].forEach((vp) => {
      vp.duration = 10;
    });
    const { times } = getSplineAndTimesForInstance(flight);
    times.forEach((time) => {
      expect(time % 10).to.equal(0);
    });
  });

  it('should add the first viewpoint again, if the flight is looped', () => {
    flight.loop = true;
    const { times } = getSplineAndTimesForInstance(flight);
    expect(times).to.have.length(flight.anchors.size + 1);
  });

  it('should set the last viewpoints duration larger 0, if it is looped', () => {
    flight.loop = true;
    flight.anchors.get(flight.anchors.size - 1).duration = 0;
    const { times } = getSplineAndTimesForInstance(flight);
    expect(times.at(-1)).to.be.gt(times.at(-2)!);
  });

  it('should set the viewpoints duration to 1, if two viewpoints following each other are identical', () => {
    const flight2 = getDummyFlight(2);
    flight2.anchors.add(flight2.anchors.get(0), 0);
    getSplineAndTimesForInstance(flight2);
    expect(flight2.anchors.get(0)).to.have.property('duration', 1);
    flight2.destroy();
  });

  it('should set the last viewpoints duration to 1, if two viewpoints following each other are identical and are looped', () => {
    const flight2 = getDummyFlight(2);
    flight2.anchors.add(flight2.anchors.get(0), 0);
    flight2.loop = true;
    getSplineAndTimesForInstance(flight2);
    expect(flight2.anchors.get(1)).to.have.property('duration', 1);
    flight2.destroy();
  });
});
