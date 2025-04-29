const defaultPoolSize =
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;

export type WorkerResult<Data, Success = boolean> = Success extends true
  ? {
      data: Data;
      success: Success;
    }
  : Success extends false
    ? {
        error: string;
        success: Success;
      }
    : never;

/**
 * Worker pool loosely based on geotiff.js Pool class.
 */
export default class WorkerPool<
  Input extends { id: number },
  ResultData = ArrayBuffer,
> {
  messageId = 0;

  private _workers: { worker: Worker; idle: boolean }[] = [];

  constructor(
    workerUrl: URL | string,
    public size = defaultPoolSize,
  ) {
    for (let i = 0; i < size; i++) {
      this._workers.push({
        worker: new Worker(workerUrl, {
          type: 'module',
        }),
        idle: true,
      });
    }
  }

  process(
    message: Omit<Input, 'id'>,
    transfer: Transferable[] = [],
  ): Promise<WorkerResult<ResultData>> {
    return new Promise((resolve) => {
      const worker =
        this._workers.find((candidate) => candidate.idle) ||
        this._workers[Math.floor(Math.random() * this.size)];
      worker.idle = false;
      this.messageId += 1;
      const id = this.messageId;
      const onMessage = (
        e: MessageEvent<{ id: number; result: unknown }>,
      ): void => {
        if (e.data.id === id) {
          worker.idle = true;
          resolve(e.data.result as WorkerResult<ResultData>);
          worker.worker.removeEventListener('message', onMessage);
        }
      };
      worker.worker.addEventListener('message', onMessage);
      worker.worker.postMessage({ id, ...message }, transfer);
    });
  }

  destroy(): void {
    this._workers.forEach((worker) => {
      worker.worker.terminate();
    });
    this._workers = [];
  }
}
