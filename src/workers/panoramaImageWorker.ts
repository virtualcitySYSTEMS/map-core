import type { PanoramaResourceType } from '../panorama/panoramaTileProvider.js';

declare let self: Worker;

type PanoramaDecoderParameters = {
  vcsPanoramaType?: PanoramaResourceType;
};
type PanoramaMessageEvent = MessageEvent<{
  jobId: number;
  buffer: ArrayBuffer;
  compression: number;
  decoderParameters: PanoramaDecoderParameters;
}>;

async function createDepthArray(buffer: Blob): Promise<Float32Array> {
  const deflateStream = new DecompressionStream('deflate');
  const decompressedStream = buffer.stream().pipeThrough(deflateStream);
  const arrayBuffer = await new Response(decompressedStream).arrayBuffer();

  const depthData = new Uint16Array(arrayBuffer);
  const result = new Float32Array(depthData.length);

  for (let i = 0; i < depthData.length; i++) {
    result[i] = depthData[i] / 65535;
  }

  return result;
}

self.addEventListener('message', (e: PanoramaMessageEvent) => {
  const { jobId, buffer, decoderParameters } = e.data;
  const { vcsPanoramaType } = decoderParameters;

  const blob = new Blob([buffer]);
  let dataPromise: Promise<ImageBitmap | Float32Array>;

  if (vcsPanoramaType === 'rgb' || vcsPanoramaType === 'intensity') {
    dataPromise = createImageBitmap(blob, { imageOrientation: 'flipY' });
  } else if (vcsPanoramaType === 'depth') {
    dataPromise = createDepthArray(blob);
  } else {
    dataPromise = Promise.reject(new Error('Missing vcsPanoramaType metadata'));
  }

  dataPromise
    .then((decoded) => {
      self.postMessage(
        { decoded, jobId },
        decoded instanceof ImageBitmap ? [decoded] : [decoded.buffer],
      );
    })
    .catch((error: unknown) => {
      self.postMessage({ error, jobId });
    });
});
