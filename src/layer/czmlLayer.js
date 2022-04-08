import { CzmlDataSource } from '@vcmap/cesium';

import DataSourceLayer from './dataSourceLayer.js';
import { vcsLayerName } from './layerSymbols.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {DataSourceOptions} CzmlOptions
 * @property {string|undefined} sourceUri
 * @api
 */

/**
 * @class
 * @export
 * @extends {DataSourceLayer}
 */
class CzmlLayer extends DataSourceLayer {
  static get className() { return 'CzmlLayer'; }

  /**
   * @returns {CzmlOptions}
   */
  static getDefaultOptions() {
    return {
      ...DataSourceLayer.getDefaultOptions(),
      sourceUri: undefined,
    };
  }

  /**
   * @param {CzmlOptions} options
   */
  constructor(options) {
    super(options);
    this.dataSource = new CzmlDataSource();
    this.entities = this.dataSource.entities;

    const defaultOptions = CzmlLayer.getDefaultOptions();
    /** @type {string|null} */
    this.sourceUri = options.sourceUri || defaultOptions.sourceUri;
    /** @type {Function} */
    this._loadedResolve = () => {};
    /** @type {Function} */
    this._loadedReject = () => {};
    /**
     * A Promise resolving with the DataSourceLayer on load
     * @type {Promise<void>}
     * @api stable
     */
    this.loaded = new Promise(((resolve, reject) => {
      this._loadedResolve = resolve;
      this._loadedReject = reject;
    }));
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  initialize() {
    if (!this._initializedPromise) {
      this._initializedPromise = this._loadData()
        .then(() => super.initialize())
        .then(() => {
          this._loadedResolve();
        })
        .catch((err) => {
          this._loadedReject(err);
        });
    }
    return this._initializedPromise;
  }

  /**
   * @returns {Promise<void>}
   * @private
   */
  async _loadData() {
    await /** @type {import("@vcmap/cesium").CzmlDataSource} */ (this.dataSource)
      .load(this.url, this.sourceUri ? { sourceUri: this.sourceUri } : undefined);

    this.entities.values.forEach((entity) => {
      entity[vcsLayerName] = this.name;
    });
    this.clock = this.dataSource.clock;
  }

  /**
   * @inheritDoc
   * @returns {Promise<void>}
   */
  async reload() {
    this.entities.removeAll();
    await this._loadData();
    await this.forceRedraw();
  }

  /**
   * @inheritDoc
   * @returns {CzmlOptions}
   */
  toJSON() {
    const config = /** @type {CzmlOptions} */ (super.toJSON());
    if (this.sourceUri) {
      config.sourceUri = this.sourceUri;
    }
    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    super.destroy();
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._entityCluster.destroy();
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._entityCluster = null;
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._entityCollection = null;
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._changed = null;
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._error = null;
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    this.dataSource._loading = null;
    this.dataSource = null;
  }
}

layerClassRegistry.registerClass(CzmlLayer.className, CzmlLayer);
export default CzmlLayer;
