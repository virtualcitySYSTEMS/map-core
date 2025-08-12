import type VcsApp from '../../vcsApp.js';
import type Layer from '../../layer/layer.js';
import CesiumMap from '../../map/cesiumMap.js';
import CesiumTilesetLayer from '../../layer/cesiumTilesetLayer.js';
import { type FlightPlayer } from './flightPlayer.js';

export type FlightPathRecorderOptions = {
  fps?: number;
  highDefinition?: boolean;
};

async function getFlightFrames(
  app: VcsApp,
  player: FlightPlayer,
  fps: number,
  cancelToken: { cancelled: boolean },
  maxNumberOfFrames = 100,
): Promise<ImageBitmap[]> {
  const scene = (app.maps.activeMap as CesiumMap).getScene()!;
  const { canvas, globe } = scene;
  let recordedTime = player.clock.currentTime - 1;
  let numberOfFrames = Math.ceil(
    (player.clock.endTime - player.clock.currentTime) * fps,
  );
  if (numberOfFrames > maxNumberOfFrames) {
    numberOfFrames = maxNumberOfFrames;
  }
  const images = new Array<Promise<ImageBitmap>>(numberOfFrames);
  const tilesetImpl = [...app.layers]
    .filter(
      (l: Layer): l is CesiumTilesetLayer =>
        l instanceof CesiumTilesetLayer && l.active,
    )
    .flatMap((tileset) =>
      tileset.getImplementationsForMap(app.maps.activeMap!),
    );

  const layerListeners = [
    app.layers.stateChanged.addEventListener((layer) => {
      if (layer instanceof CesiumTilesetLayer) {
        const implementations = layer.getImplementationsForMap(
          app.maps.activeMap!,
        );
        if (layer.active) {
          tilesetImpl.push(...implementations);
        } else {
          implementations.forEach((impl) => {
            tilesetImpl.splice(
              tilesetImpl.findIndex((i) => i === impl),
              1,
            );
          });
        }
      }
    }),
  ];

  let currentFrame = 0;
  await new Promise<void>((resolve) => {
    const handler = scene.postRender.addEventListener(() => {
      if (cancelToken.cancelled) {
        handler();
        return;
      }

      if (globe.tilesLoaded) {
        if (tilesetImpl.some((impl) => !impl.cesium3DTileset?.tilesLoaded)) {
          return;
        }
        if (player.clock.currentTime === recordedTime) {
          return;
        }

        recordedTime = player.clock.currentTime;
        images[currentFrame] = createImageBitmap(canvas);
        if (player.clock.currentTime === player.clock.endTime) {
          handler();
          resolve();
        }

        let nextTick = player.clock.currentTime + 1 / fps;
        if (nextTick >= player.clock.endTime) {
          nextTick = player.clock.endTime;
        }
        player.goToTime(nextTick);
        currentFrame += 1;
        if (currentFrame >= numberOfFrames) {
          handler();
          resolve();
        }
      }
    });
  });

  layerListeners.forEach((listener) => {
    listener();
  });

  return Promise.all(images);
}

export function createFlightMovie(
  app: VcsApp,
  player: FlightPlayer,
  options?: FlightPathRecorderOptions,
): { start: () => Promise<Blob>; cancel: () => void } {
  if (!(app.maps.activeMap instanceof CesiumMap)) {
    throw new Error('No active Cesium map found');
  }

  const cancelToken = { cancelled: false };
  const videoBitsPerSecond = options?.highDefinition ? 12000000 : 6000000;

  const map = app.maps.activeMap;
  const scene = map.getScene()!;
  const { canvas } = scene;

  const destinationCanvas = document.createElement('canvas');
  destinationCanvas.width = canvas.width;
  destinationCanvas.height = canvas.height;
  const context = destinationCanvas.getContext('2d')!;

  const stream = destinationCanvas.captureStream(options?.fps ?? 30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm',
    videoBitsPerSecond,
  });

  const resetMapControls = app.maps.requestExclusiveMapControls(
    { apiCalls: true, keyEvents: true, pointerEvents: true },
    () => {},
  );

  const finished = new Promise<Blob>((resolve, reject) => {
    const chunksBuffer: Blob[] = [];

    recorder.ondataavailable = (event): void => {
      if (event.data.size > 0) {
        chunksBuffer.push(event.data);
      }
    };

    recorder.onerror = reject;
    recorder.onstop = (): void => {
      if (cancelToken.cancelled) {
        return;
      }
      resolve(new Blob(chunksBuffer, { type: 'video/webm' }));
    };
  });

  const renderBuffer = (buffer: ImageBitmap[]): Promise<void> => {
    let interval: ReturnType<typeof setInterval>;
    const promise = new Promise<void>((resolve) => {
      const frameDuration = 1000 / (options?.fps || 30);
      let currentFrame = 0;
      interval = setInterval(() => {
        if (cancelToken.cancelled) {
          resolve();
        }
        const image = buffer[currentFrame];
        if (image) {
          context.drawImage(image, 0, 0);
          currentFrame += 1;
          if (currentFrame >= buffer.length) {
            resolve();
          }
        } else {
          resolve();
        }
      }, frameDuration);
    });

    return promise
      .then(() => {
        clearInterval(interval);
      })
      .catch((err: unknown) => {
        clearInterval(interval);
        throw err;
      });
  };

  const requestBuffer = async (): Promise<boolean> => {
    const images = await getFlightFrames(
      app,
      player,
      options?.fps ?? 30,
      cancelToken,
    );

    map.getCesiumWidget()!.useDefaultRenderLoop = false;
    if (recorder.state === 'paused') {
      recorder.resume();
    } else {
      recorder.start();
    }

    await renderBuffer(images);
    map.getCesiumWidget()!.useDefaultRenderLoop = true;
    if (
      player.clock.currentTime === player.clock.endTime ||
      cancelToken.cancelled
    ) {
      return false;
    }
    recorder.pause();
    recorder.requestData();
    return true;
  };

  const reset = (): void => {
    map.getCesiumWidget()!.useDefaultRenderLoop = true;
    resetMapControls?.();
  };

  async function start(): Promise<Blob> {
    let buffering = true;
    while (buffering) {
      // eslint-disable-next-line no-await-in-loop
      buffering = await requestBuffer();
    }
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    reset();
    return finished;
  }

  const cancel = (): void => {
    cancelToken.cancelled = true;
    reset();
    recorder.stop();
  };

  return { start, cancel };
}
