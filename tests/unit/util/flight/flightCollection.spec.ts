import { SinonSpy } from 'sinon';
import { expect } from 'chai';
import { describe } from 'mocha';
import getDummyFlight from './getDummyFlightInstance.js';
import { getVcsEventSpy, setCesiumMap } from '../../helpers/cesiumHelpers.js';
import {
  FlightInstance,
  FlightCollection,
  VcsApp,
  FlightPlayer,
} from '../../../../index.js';

describe('FlightCollection', () => {
  let flightCollection: FlightCollection;
  let flight: FlightInstance;
  let app: VcsApp;
  let FP: FlightPlayer | undefined;
  let playerChangedSpy: SinonSpy;

  before(async () => {
    app = new VcsApp();
    await setCesiumMap(app);
    flight = getDummyFlight();
    flightCollection = new FlightCollection(app);
    playerChangedSpy = getVcsEventSpy(flightCollection.playerChanged);
    FP = await flightCollection.setPlayerForFlight(flight);
  });

  after(() => {
    flight.destroy();
    flightCollection.destroy();
    app.destroy();
  });

  describe('setPlayerForFlight', () => {
    it('should create and set a player', () => {
      expect(flightCollection).to.have.property('player', FP);
    });
    it('should raise playerChanged event', () => {
      expect(playerChangedSpy).to.have.been.calledOnceWith(FP);
    });
    it('should set player to undefined, if player is destroyed', () => {
      playerChangedSpy = getVcsEventSpy(flightCollection.playerChanged);
      FP!.destroy();
      expect(playerChangedSpy).to.have.been.calledOnceWith(undefined);
      expect(flightCollection).to.have.property('player', undefined);
    });
  });

  describe('setPlayerForFlight, when another flight is active', () => {
    let flight2: FlightInstance;
    let FP2: FlightPlayer | undefined;
    let FPdestroyedSpy: SinonSpy;

    before(async () => {
      FP = await flightCollection.setPlayerForFlight(flight);
      flight2 = getDummyFlight();
      playerChangedSpy = getVcsEventSpy(flightCollection.playerChanged);
      FPdestroyedSpy = getVcsEventSpy(FP?.destroyed);
      FP2 = await flightCollection.setPlayerForFlight(flight2);
    });

    after(() => {
      flight2.destroy();
    });

    it('should stop and destroy previous flight player', () => {
      expect(FP).to.have.property('state', 'stopped');
      expect(FPdestroyedSpy).to.have.been.called;
    });
    it('should raise playerChanged event', () => {
      expect(playerChangedSpy).to.have.been.calledOnceWith(FP2);
    });
  });

  describe('removing a playing flight', () => {
    let FPdestroyedSpy: SinonSpy;

    before(async () => {
      flight = getDummyFlight();
      flightCollection = new FlightCollection(app);
      FP = await flightCollection.setPlayerForFlight(flight);
      playerChangedSpy = getVcsEventSpy(flightCollection.playerChanged);
      FPdestroyedSpy = getVcsEventSpy(FP!.destroyed);
      FP!.play();
      flightCollection.remove(flight);
    });

    it('should stop and destroy the flight player', () => {
      expect(FP).to.have.property('state', 'stopped');
      expect(FPdestroyedSpy).to.have.been.called;
    });
    it('should raise playerChanged event and unset the player', () => {
      expect(playerChangedSpy).to.have.been.calledOnceWith(undefined);
      expect(flightCollection).to.have.property('player', undefined);
    });
  });
});
