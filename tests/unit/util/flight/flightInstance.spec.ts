import { expect } from 'chai';
import nock from 'nock';
import {
  anchorFromViewpoint,
  FlightAnchor,
  FlightInstance,
  FlightInstanceOptions,
  Viewpoint,
} from '../../../../index.js';
import { getVcsEventSpy } from '../../helpers/cesiumHelpers.js';
import { createAnchor } from './getDummyFlightInstance.js';

describe('FlightInstance', () => {
  let FI: FlightInstance;

  beforeEach(() => {
    FI = new FlightInstance({
      name: 'test',
    });
  });

  afterEach(() => {
    FI.destroy();
  });

  describe('anchors changed', () => {
    let anchor: FlightAnchor;

    beforeEach(async () => {
      await FI.initialize();
      anchor = createAnchor();
    });

    afterEach(() => {
      anchor.destroy();
    });

    it('should raise changed, when adding a new anchor', () => {
      const spy = getVcsEventSpy(FI.anchorsChanged);
      FI.anchors.add(anchor);
      expect(spy).to.have.been.called;
    });

    it('should raise changed when removing an anchor', () => {
      FI.anchors.add(
        anchorFromViewpoint(
          new Viewpoint({
            cameraPosition: [0, 0, 0],
          }),
        )!,
      );
      FI.anchors.add(anchor);
      const spy = getVcsEventSpy(FI.anchorsChanged);
      FI.anchors.remove(anchor);
      expect(spy).to.have.been.called;
    });

    it('should raise changed, when moving an anchor', () => {
      FI.anchors.add(
        anchorFromViewpoint(
          new Viewpoint({
            cameraPosition: [0, 0, 0],
          }),
        )!,
      );
      FI.anchors.add(anchor);
      const spy = getVcsEventSpy(FI.anchorsChanged);
      FI.anchors.lower(anchor);
      expect(spy).to.have.been.called;
    });

    it('should raise change, when changing an anchor property', () => {
      FI.anchors.add(anchor);
      const spy = getVcsEventSpy(FI.anchorsChanged);
      anchor.duration = 2;
      expect(spy).to.have.been.called;
    });

    it('should no longer listen to changes on removed anchors', () => {
      FI.anchors.add(anchor);
      FI.anchors.remove(anchor);
      const spy = getVcsEventSpy(FI.anchorsChanged);
      anchor.duration = 2;
      expect(spy).to.not.have.been.called;
    });
  });

  describe('property changed', () => {
    it('should raise on loop change', () => {
      const spy = getVcsEventSpy(FI.propertyChanged);
      FI.loop = !FI.loop;
      expect(spy).to.have.been.calledOnceWith('loop');
    });

    it('should raise on multiplier change', () => {
      const spy = getVcsEventSpy(FI.propertyChanged);
      FI.multiplier += 1;
      expect(spy).to.have.been.calledOnceWith('multiplier');
    });

    it('should raise on interpolation change', () => {
      const spy = getVcsEventSpy(FI.propertyChanged);
      FI.interpolation = 'linear';
      expect(spy).to.have.been.calledOnceWith('interpolation');
    });

    it('should not be raised if not changing the value', () => {
      const spy = getVcsEventSpy(FI.propertyChanged);
      // eslint-disable-next-line no-self-assign
      FI.interpolation = FI.interpolation;
      expect(spy).to.not.have.been.called;
    });
  });

  describe('initialize', () => {
    it('should return the same readyPromise', async () => {
      const initialize = FI.initialize();
      expect(FI.initialize()).to.equal(initialize);
      await initialize;
    });

    it('should set initialized', async () => {
      expect(FI.initialized).to.be.false;
      await FI.initialize();
      expect(FI.initialized).to.be.true;
    });

    it('should assign the return value from an url response', async () => {
      nock('http://localhost')
        .get('/test')
        .reply(200, {
          features: [],
          vcsMeta: { flightOptions: { loop: true } },
        });
      const flightInstance = new FlightInstance({
        url: 'http://localhost/test',
        loop: false,
      });
      await flightInstance.initialize();
      expect(flightInstance.loop).to.be.true;
    });
  });

  describe('isValid', () => {
    it('should be false, if there are less then 2 viewpoints', () => {
      expect(FI.isValid()).to.be.false;
    });
  });

  describe('toJSON', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const flight = new FlightInstance({});
        const config = flight.toJSON();
        flight.destroy();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured object', () => {
      let input: FlightInstanceOptions;
      let output: FlightInstanceOptions;

      before(() => {
        input = {
          interpolation: 'linear',
          multiplier: 2,
          loop: true,
          anchors: [
            {
              type: 'Feature',
              id: 'String1',
              geometry: {
                type: 'Point',
                coordinates: [0, 0, 0],
              },
              properties: {
                heading: 0,
                pitch: 0,
                roll: 0,
                duration: 1,
              },
            },
            {
              type: 'Feature',
              id: 'String2',
              geometry: {
                type: 'Point',
                coordinates: [0, 0, 0],
              },
              properties: {
                heading: 0,
                pitch: 0,
                roll: 0,
                duration: 1,
                title: 'foo',
              },
            },
          ],
        };
        const flight = new FlightInstance(input);
        output = flight.toJSON();
        flight.destroy();
      });

      it('should configure interpolation', () => {
        expect(output.interpolation).to.equal(input.interpolation);
      });

      it('should configure loop', () => {
        expect(output.loop).to.equal(input.loop);
      });

      it('should configure multiplier', () => {
        expect(output.multiplier).to.equal(input.multiplier);
      });

      it('should configure anchors', () => {
        expect(output.anchors).to.have.lengthOf(2);
        expect(output.anchors?.[0]).to.eql(input.anchors?.[0]);
        expect(output.anchors?.[1]).to.eql(input.anchors?.[1]);
      });
    });

    describe('of an object with a URL', () => {
      it('should only write out the type, name and URL', () => {
        const flight = new FlightInstance({
          url: 'foo',
          interpolation: 'linear',
        });
        const config = flight.toJSON();
        flight.destroy();
        expect(config).to.have.all.keys('name', 'type', 'url');
      });
    });
  });
});
