import { SplitDirection } from '@vcmap/cesium';

import { parseNumberRange, parseInteger } from '@vcsuite/parsers';
import Layer from './layer.js';
import OpenlayersMap from '../map/openlayersMap.js';
import CesiumMap from '../map/cesiumMap.js';
import OpenStreetMapOpenlayersImpl from './openlayers/openStreetMapOpenlayersImpl.js';
import OpenStreetMapCesiumImpl from './cesium/openStreetMapCesiumImpl.js';
import VcsEvent from '../vcsEvent.js';
import { layerClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} OpenStreetMapOptions
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied
 * @property {number} [opacity=1.0] - opacity between 0 and 1
 * @property {number} [maxLevel=19] - max level to load tiles at
 * @api
 */

/**
 * OpenStreetMapLayer Layer
 * @class
 * @export
 * @extends {Layer}
 * @api stable
 * @implements {SplitLayer}
 */
class OpenStreetMapLayer extends Layer {
  static get className() { return 'OpenStreetMapLayer'; }

  /**
   * @returns {OpenStreetMapOptions}
   */
  static getDefaultOptions() {
    return {
      ...Layer.getDefaultOptions,
      splitDirection: undefined,
      opacity: 1,
      maxLevel: 19,
    };
  }

  /**
   * @param {OpenStreetMapOptions} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = OpenStreetMapLayer.getDefaultOptions();
    /**
     * @type {import("@vcmap/cesium").SplitDirection}
     * @private
     */
    this._splitDirection = SplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        SplitDirection.LEFT :
        SplitDirection.RIGHT;
    }

    this._supportedMaps = [
      CesiumMap.className,
      OpenlayersMap.className,
    ];

    /**
     * @type {number}
     * @private
     */
    this._opacity = parseNumberRange(options.opacity, defaultOptions.opacity, 0.0, 1.0);

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {VcsEvent<import("@vcmap/cesium").SplitDirection>}
     * @api
     */
    this.splitDirectionChanged = new VcsEvent();

    /**
     * The maximum level to load. Changing requires a redraw to take effect.
     * @type {number}
     * @api
     */
    this.maxLevel = parseInteger(options.maxLevel, defaultOptions.maxLevel);
  }

  /**
   * @api
   * @type {import("@vcmap/cesium").SplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {import("@vcmap/cesium").SplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        /** @type {OpenStreetMapCesiumImpl|OpenStreetMapOpenlayersImpl} */
        (impl).updateSplitDirection(this._splitDirection);
      });
      this.splitDirectionChanged.raiseEvent(this._splitDirection);
    }
  }

  /**
   * The opacity between 0 (fully transparent) and 1 (fully opaque)
   * @api
   * @type {number}
   */
  get opacity() { return this._opacity; }

  /**
   * @param {number} opacity
   */
  set opacity(opacity) {
    const parsedValue = parseNumberRange(opacity, this._opacity, 0, 1);
    if (this._opacity !== parsedValue) {
      this._opacity = parsedValue;
      this.getImplementations().forEach((impl) => {
        /** @type {OpenStreetMapCesiumImpl|OpenStreetMapOpenlayersImpl} */
        (impl).updateOpacity(parsedValue);
      });
    }
  }

  /**
   * @inheritDoc
   * @returns {RasterLayerImplementationOptions}
   */
  getImplementationOptions() {
    return {
      ...super.getImplementationOptions(),
      opacity: this.opacity,
      splitDirection: this.splitDirection,
      minLevel: 0,
      maxLevel: this.maxLevel,
      tilingSchema: '',
    };
  }

  /**
   * @inheritDoc
   * @param {import("@vcmap/core").VcsMap} map
   * @returns {Array<OpenStreetMapOpenlayersImpl|OpenStreetMapCesiumImpl>}
   */
  createImplementationsForMap(map) {
    if (map instanceof OpenlayersMap) {
      return [new OpenStreetMapOpenlayersImpl(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new OpenStreetMapCesiumImpl(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {OpenStreetMapOptions}
   */
  toJSON() {
    const config = /** @type {OpenStreetMapOptions} */ (super.toJSON());
    const defaultOptions = OpenStreetMapLayer.getDefaultOptions();

    if (this._splitDirection !== SplitDirection.NONE) {
      config.splitDirection = this._splitDirection === SplitDirection.RIGHT ?
        'right' :
        'left';
    }

    if (this.opacity !== defaultOptions.opacity) {
      config.opacity = this.opacity;
    }

    if (this.maxLevel !== defaultOptions.maxLevel) {
      config.maxLevel = this.maxLevel;
    }

    return config;
  }

  /**
   * @inheritDoc
   */
  destroy() {
    this.splitDirectionChanged.destroy();
    super.destroy();
  }
}

layerClassRegistry.registerClass(OpenStreetMapLayer.className, OpenStreetMapLayer);
export default OpenStreetMapLayer;
