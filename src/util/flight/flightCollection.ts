import Collection from '../collection.js';
import { createFlightPlayer, FlightPlayer } from './flightPlayer.js';
import VcsEvent from '../../vcsEvent.js';
import FlightInstance from './flightInstance.js';
import type VcsApp from '../../vcsApp.js';

/**
 * A collection of flights. Provides playFlight API, which returns a FlightPlayer.
 * Emits playerChanged event, whenever another flight is played.
 */
class FlightCollection extends Collection<FlightInstance> {
  private readonly _app: VcsApp;

  private _player: FlightPlayer | undefined;

  playerChanged: VcsEvent<FlightPlayer | undefined>;

  private _playerDestroyedListener: () => void;

  constructor(app: VcsApp) {
    super();

    this._app = app;
    this._player = undefined;
    this.playerChanged = new VcsEvent<FlightPlayer | undefined>();
    this._playerDestroyedListener = (): void => {};
  }

  get player(): FlightPlayer | undefined {
    return this._player;
  }

  remove(item: FlightInstance): void {
    if (this._player?.flightInstanceName === item.name) {
      this._player.stop();
      this._player.destroy();
    }
    super.remove(item);
  }

  /**
   * Creates a FlightPlayer for a flight instance, if not already existing for provided instance
   * @param flight
   */
  async setPlayerForFlight(
    flight: FlightInstance,
  ): Promise<FlightPlayer | undefined> {
    if (this._player?.flightInstanceName === flight.name) {
      return this._player;
    } else if (this._player) {
      this._playerDestroyedListener();
      this._player.stop();
      this._player.destroy();
    }
    this._player = await createFlightPlayer(flight, this._app);
    this.playerChanged.raiseEvent(this._player);
    this._playerDestroyedListener = this._player.destroyed.addEventListener(
      () => {
        this._player = undefined;
        this.playerChanged.raiseEvent(undefined);
      },
    );
    return this._player;
  }

  destroy(): void {
    if (this._player) {
      this._player.stop();
      this._player.destroy();
      this._player = undefined;
    }
    this.playerChanged.destroy();
    this._playerDestroyedListener();
    super.destroy();
  }
}

export default FlightCollection;
