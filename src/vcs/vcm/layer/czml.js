import CzmlDataSource from 'cesium/Source/DataSources/CzmlDataSource.js';

import DataSource from './dataSource.js';
import { vcsLayerName } from './layerSymbols.js';

/**
 * @typedef {vcs.vcm.layer.DataSource.Options} vcs.vcm.layer.Czml.Options
 * @property {string|undefined} sourceUri
 * @api
 */

/**
 * @class
 * @export
 * @extends {vcs.vcm.layer.DataSource}
 * @memberOf vcs.vcm.layer
 */
class Czml extends DataSource {
  static get className() { return 'vcs.vcm.layer.Czml'; }

  /**
   * @returns {vcs.vcm.layer.Czml.Options}
   */
  static getDefaultOptions() {
    return {
      ...DataSource.getDefaultOptions(),
      sourceUri: undefined,
    };
  }

  /**
   * @param {vcs.vcm.layer.Czml.Options} options
   */
  constructor(options) {
    super(options);
    this.dataSource = new CzmlDataSource();
    this.entities = this.dataSource.entities;

    const defaultOptions = Czml.getDefaultOptions();
    /** @type {string|null} */
    this.sourceUri = options.sourceUri || defaultOptions.sourceUri;
    /** @type {Function} */
    this._loadedResolve = () => {};
    /** @type {Function} */
    this._loadedReject = () => {};
    /**
     * A Promise resolving with the DataSource on load
     * @type {Promise}
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
    const loaded = /** @type {Cesium/CzmlDataSource} */ (this.dataSource)
      .load(this.url, this.sourceUri ? { sourceUri: this.sourceUri } : undefined);
    await new Promise((resolve, reject) => {
      loaded.then(resolve, reject);
    });
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
   * @returns {vcs.vcm.layer.Czml.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.Czml.Options} */ (super.getConfigObject());
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

export default Czml;
