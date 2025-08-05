import { expect } from 'chai';
import sinon from 'sinon';
import { createFlightMovie } from '../../../../src/util/flight/flightRecorder.js';
import getDummyFlight from './getDummyFlightInstance.js';
import type {
  CesiumMap,
  FlightInstance,
  FlightPlayer,
  OpenlayersMap,
} from '../../../../index.js';
import { createFlightPlayer, VcsApp } from '../../../../index.js';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';
import { getOpenlayersMap } from '../../helpers/openlayersHelpers.js';

describe('flightRecorder', () => {
  let app: VcsApp;
  let player: FlightPlayer;
  let cesiumMap: CesiumMap;
  let olMap: OpenlayersMap;

  before(async () => {
    // Mock MediaRecorder for Node.js environment
    class MockMediaRecorder {
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType: string;
      private _isRecording = false;

      constructor(_: MediaStream, options: { mimeType: string }) {
        this.mimeType = options.mimeType;
      }

      start(): void {
        this._isRecording = true;
        setTimeout(() => {
          if (this.ondataavailable && this._isRecording) {
            this.ondataavailable({
              data: new Blob(['mock'], { type: this.mimeType }),
            });
          }
        }, 10);
      }

      stop(): void {
        this._isRecording = false;
        setTimeout(() => {
          if (this.onstop) this.onstop();
        }, 15);
      }
    }

    // Mock canvas methods
    const mockTracks = [{ stop: sinon.stub() }];
    HTMLCanvasElement.prototype.captureStream =
      function captureStream(): MediaStream {
        const mockStream: MediaStream = {
          getTracks: (): Array<{ stop: () => void }> => mockTracks,
        } as unknown as MediaStream;
        return mockStream;
      };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (global as any).MediaRecorder = MockMediaRecorder;

    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
    olMap = await getOpenlayersMap();
  });

  after(() => {
    sinon.restore();
    app.destroy();
  });

  beforeEach(async () => {
    const flight = getDummyFlight(2);
    player = await createFlightPlayer(flight, app);
  });

  afterEach(() => {
    player.destroy();
  });

  describe('creation', () => {
    it('should throw if no active Cesium map is present', async () => {
      app.maps.add(olMap);
      await app.maps.setActiveMap(olMap.name);
      expect(() => createFlightMovie(app, player)).to.throw(
        'No active Cesium map found',
      );
      await app.maps.setActiveMap(cesiumMap.name);
    });
  });

  describe('recording', () => {
    it('should handle cancellation during recording gracefully', async () => {
      const recorder = createFlightMovie(app, player, { fps: 2 });

      // Don't wait for the start promise, just cancel immediately
      recorder.start().catch(() => {
        // Expected when cancelled
      });

      // Cancel immediately - this should not throw
      expect(() => {
        recorder.cancel();
      }).to.not.throw();

      // Wait a bit to let any cleanup happen
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    });
  });

  describe('cancel API and ready checks', () => {
    let exclusiveMapControlsChangedSpy: sinon.SinonSpy;
    let recorder: ReturnType<typeof createFlightMovie>;
    let testFlight: FlightInstance;

    beforeEach(() => {
      exclusiveMapControlsChangedSpy = sinon.spy(
        app.maps.exclusiveMapControlsChanged,
        'raiseEvent',
      );
      recorder = createFlightMovie(app, player, { fps: 2 });
      testFlight = getDummyFlight(2);
    });

    afterEach(() => {
      exclusiveMapControlsChangedSpy.restore();
      testFlight.destroy();
    });

    it('should handle multiple cancellations gracefully', () => {
      expect(() => {
        recorder.cancel();
        recorder.cancel();
      }).to.not.throw;
    });

    it('should request and reset map controls correctly', () => {
      expect(exclusiveMapControlsChangedSpy).to.have.been.calledWith(
        sinon.match({
          options: { apiCalls: true, keyEvents: true, pointerEvents: true },
        }),
      );
      recorder.cancel();
      expect(exclusiveMapControlsChangedSpy).to.have.been.calledWith(
        sinon.match({
          options: { apiCalls: false, keyEvents: false, pointerEvents: false },
        }),
      );
    });
  });
});
