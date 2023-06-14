import { CzmlDataSource } from '@vcmap-cesium/engine';

import DataSourceLayer from './dataSourceLayer.js';
import { vcsLayerName } from './layerSymbols.js';
import { layerClassRegistry } from '../classRegistry.js';
import type { LayerOptions } from './layer.js';

export type CzmlOptions = LayerOptions & {
  sourceUri?: string;
};

/**
 * @group Layer
 */
class CzmlLayer extends DataSourceLayer {
  static get className(): string {
    return 'CzmlLayer';
  }

  static getDefaultOptions(): CzmlOptions {
    return {
      ...DataSourceLayer.getDefaultOptions(),
      sourceUri: undefined,
    };
  }

  private _dataSource: CzmlDataSource | null = new CzmlDataSource();

  sourceUri: string | undefined;

  // eslint-disable-next-line class-methods-use-this
  private _loadedResolve: () => void = () => {};

  // eslint-disable-next-line class-methods-use-this
  private _loadedReject: (err: Error) => void = () => {};

  /**
   * A Promise resolving with the DataSourceLayer on load
   */
  loaded: Promise<void> = new Promise((resolve, reject) => {
    this._loadedResolve = resolve;
    this._loadedReject = reject;
  });

  private _initializedPromise: Promise<void> | undefined;

  /**
   * @param  options
   */
  constructor(options: CzmlOptions) {
    super(options);
    this.entities = this.dataSource.entities;

    const defaultOptions = CzmlLayer.getDefaultOptions();
    this.sourceUri = options.sourceUri || defaultOptions.sourceUri;
  }

  get dataSource(): CzmlDataSource {
    if (!this._dataSource) {
      throw new Error('Accessing destroyed czml layer');
    }
    return this._dataSource;
  }

  set dataSource(dataSource: CzmlDataSource) {
    this._dataSource = dataSource;
  }

  initialize(): Promise<void> {
    if (!this._initializedPromise) {
      this._initializedPromise = this._loadData()
        .then(() => super.initialize())
        .then(() => {
          this._loadedResolve();
        })
        .catch((err) => {
          this._loadedReject(err as Error);
        });
    }
    return this._initializedPromise;
  }

  private async _loadData(): Promise<void> {
    await this.dataSource.load(
      this.url,
      this.sourceUri ? { sourceUri: this.sourceUri } : undefined,
    );

    this.entities.values.forEach((entity) => {
      entity[vcsLayerName] = this.name;
    });
    this.clock = this.dataSource.clock;
  }

  async reload(): Promise<void> {
    this.entities.removeAll();
    await this._loadData();
    await this.forceRedraw();
  }

  toJSON(): CzmlOptions {
    const config: CzmlOptions = super.toJSON();
    if (this.sourceUri) {
      config.sourceUri = this.sourceUri;
    }
    return config;
  }

  destroy(): void {
    super.destroy();

    if (this._dataSource) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      this._dataSource._entityCluster.destroy();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._dataSource._entityCluster = null;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._dataSource._entityCollection = null;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._dataSource._changed = null;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._dataSource._error = null;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      this._dataSource._loading = null;
    }

    this._dataSource = null;
  }
}

layerClassRegistry.registerClass(CzmlLayer.className, CzmlLayer);
export default CzmlLayer;
