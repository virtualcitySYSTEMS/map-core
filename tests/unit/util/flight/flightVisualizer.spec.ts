import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import {
  createFlightVisualization,
  VcsApp,
  FlightVisualization,
  FlightInstance,
  CesiumMap,
  VectorLayer,
  LayerState,
} from '../../../../index.js';
import getDummyFlight from './getDummyFlightInstance.js';
import { getVcsEventSpy, setCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('FlightVisualizer', () => {
  let FV: FlightVisualization;
  let flight: FlightInstance;
  let cesiumMap: CesiumMap;
  let app: VcsApp;

  before(async () => {
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(async () => {
    flight = getDummyFlight();
    FV = await createFlightVisualization(flight, app);
  });

  afterEach(() => {
    FV.destroy();
    flight.destroy();
  });

  after(() => {
    app.destroy();
  });

  describe('creating features', () => {
    it('should create a point feature for each vp', () => {
      const vps = (
        app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
      )
        .getFeatures()
        .filter((f) => f.getId() !== 'flightPathGeom');
      expect(vps).to.have.length(flight.anchors.size);
    });

    it('should create a camera primitive for each vp', () => {
      expect(cesiumMap.getScene()?.primitives.get(0)).to.have.property(
        'length',
        flight.anchors.size,
      );
    });

    describe('flightPath', () => {
      it('should create a feature for the flight path with the flightPathGeom id', () => {
        const flightPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom');
        expect(flightPath).to.be.an.instanceOf(Feature);
        expect(flightPath?.getGeometry()).to.be.and.instanceOf(LineString);
      });

      it('should close the flightPath, if the flight instance is looped', () => {
        flight.loop = true;
        const flightPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom') as Feature<LineString>;
        const coordinates = flightPath.getGeometry()!.getCoordinates();
        expect(coordinates[0]).to.have.members(
          coordinates[coordinates.length - 1],
        );
        flight.interpolation = 'linear';
        const linearPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom') as Feature<LineString>;
        const linearCoordinates = linearPath.getGeometry()!.getCoordinates();
        expect(linearCoordinates[0]).to.have.members(
          linearCoordinates[linearCoordinates.length - 1],
        );
      });

      it('should add a coordinate for each 0.2s time step of the flight, plus the last clock time', () => {
        [...flight.anchors].forEach((vp) => {
          vp.duration = 10;
        });
        const flightPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom') as Feature<LineString>;
        const coordinates = flightPath.getGeometry()!.getCoordinates();
        expect(coordinates).to.have.length((flight.anchors.size - 1) * 50 + 1);
      });

      it('should not create more then 501 points', () => {
        [...flight.anchors].forEach((vp) => {
          vp.duration = 100;
        });
        const flightPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom') as Feature<LineString>;
        const coordinates = flightPath.getGeometry()!.getCoordinates();
        expect(coordinates).to.have.length(501);
      });

      it('should create a coordinate per VP if interpolation is linear', () => {
        flight.interpolation = 'linear';
        const flightPath = (
          app.layers.getByKey(`flightLayer-${flight.name}`) as VectorLayer
        ).getFeatureById('flightPathGeom') as Feature<LineString>;
        const coordinates = flightPath.getGeometry()!.getCoordinates();
        expect(coordinates).to.have.length(flight.anchors.size);
      });
    });
  });

  describe('change visualization state', () => {
    describe('of an inactive visualization', () => {
      it('should change the state to loading and then active on the visualizations', async () => {
        const showing = FV.activate();
        expect(FV.state).to.equal(LayerState.LOADING);
        await showing;
        expect(FV.state).to.equal(LayerState.ACTIVE);
      });

      it('should raise state changed when activating', async () => {
        const spy = getVcsEventSpy(FV.stateChanged);
        await FV.activate();
        expect(spy).to.have.been.called;
      });

      it('should not raise state changed, when calling deactivate on an inactive visualization', () => {
        const spy = getVcsEventSpy(FV.stateChanged);
        FV.deactivate();
        expect(spy).to.not.have.been.called;
      });
    });

    describe('of an active visualization', () => {
      beforeEach(async () => {
        await FV.activate();
      });

      it('should change the state to inactive when hiding visualizations', () => {
        FV.deactivate();
        expect(FV.state).to.equal(LayerState.INACTIVE);
      });

      it('should raise state changed on deactivation', () => {
        const spy = getVcsEventSpy(FV.stateChanged);
        FV.deactivate();
        expect(spy).to.have.been.calledOnce;
      });

      it('should not raise state changed, when calling activate on an active visualization', async () => {
        const spy = getVcsEventSpy(FV.stateChanged);
        await FV.activate();
        expect(spy).to.not.have.been.called;
      });
    });
  });

  describe('manipulation the flights collection', () => {
    it('should destroy the visualization, when adding a flight with the same name to the app', () => {
      const spy = getVcsEventSpy(FV.destroyed);
      app.flights.add(flight);
      expect(spy).to.have.been.called;
    });

    it('should destroy the visualization when removing the flight', async () => {
      FV.destroy();
      app.flights.add(flight);
      FV = await createFlightVisualization(flight, app);
      const spy = getVcsEventSpy(FV.destroyed);
      app.flights.remove(flight);
      expect(spy).to.have.been.called;
    });

    it('should return the existing visualization when visualizing the same flight twice', async () => {
      const spy = getVcsEventSpy(FV.destroyed);
      FV = await createFlightVisualization(flight, app);
      expect(spy).to.not.have.been.called;
    });
  });
});
