declare let self: Worker;

export type DepthProcessingMessage = {
  id: number;
  data: ArrayBuffer;
  width: number;
  height: number;
  kernelRadius?: number;
};

/**
 * Process depth data with a kernel operation similar to the shader implementation
 * @param depthData - Raw U16 depth data
 * @param width - Image width
 * @param height - Image height
 * @param kernelRadius - Radius for the kernel operation
 * @returns Processed depth data as U16 values
 */
function processDepthWithKernel(
  depthData: Uint16Array,
  width: number,
  height: number,
  kernelRadius: number,
): Float32Array {
  const kernelSize = kernelRadius * 2 + 1;
  const result = new Float32Array(depthData.length);
  const totalKernelElements = kernelSize * kernelSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;

      const sampledValues = new Array<number>(totalKernelElements);
      let targetValue = Number.MAX_VALUE; // We want the minimum depth value
      let sampleIndex = 0;

      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          // XXX along the edges, this will re-sample the edge
          const sampleX = Math.max(0, Math.min(width - 1, x + kx));
          const sampleY = Math.max(0, Math.min(height - 1, y + ky));
          const depthIndex = sampleY * width + sampleX;

          const sampleValue = depthData[depthIndex];

          if (sampleValue > 0) {
            sampledValues[sampleIndex] = sampleValue;
            targetValue = Math.min(targetValue, sampleValue);
          } else {
            sampledValues[sampleIndex] = 0;
          }
          sampleIndex += 1;
        }
      }

      const threshold = (0.2 / 50.0) * 65535; // 0.2m in 65535 range
      let sum = 0;
      let count = 0;

      for (let i = 0; i < totalKernelElements; i++) {
        const value = sampledValues[i];
        if (value > 0 && Math.abs(value - targetValue) < threshold) {
          sum += value;
          count += 1;
        }
      }

      if (count > 0) {
        const avg = sum / count;
        result[pixelIndex] = avg / 65535;
      } else {
        result[pixelIndex] = 0;
      }
    }
  }

  return result;
}

self.addEventListener('message', (e: MessageEvent<DepthProcessingMessage>) => {
  const { data, width, height, kernelRadius = 3, id } = e.data;

  try {
    const depthData = new Uint16Array(data);
    const processedData = processDepthWithKernel(
      depthData,
      width,
      height,
      kernelRadius,
    );

    self.postMessage(
      {
        id,
        result: {
          data: processedData.buffer,
          success: true,
        },
      },
      [processedData.buffer],
    );
  } catch (error) {
    self.postMessage({
      id,
      result: {
        error: (error as Error).message,
        success: false,
      },
    });
  }
});
