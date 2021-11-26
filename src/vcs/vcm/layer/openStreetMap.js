import { ImagerySplitDirection } from '@vcmap/cesium';

import { parseNumberRange, parseInteger } from '@vcsuite/parsers';
import Layer from './layer.js';
import Openlayers from '../maps/openlayers.js';
import CesiumMap from '../maps/cesium.js';
import OpenStreetMapOpenlayers from './openlayers/openStreetMapOpenlayers.js';
import OpenStreetMapCesium from './cesium/openStreetMapCesium.js';
import VcsEvent from '../event/vcsEvent.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {LayerOptions} OpenStreetMapOptions
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied
 * @property {number} [opacity=1.0] - opacity between 0 and 1
 * @property {number} [maxLevel=19] - max level to load tiles at
 * @api
 */

/**
 * OpenStreetMap Layer
 * @class
 * @export
 * @extends {Layer}
 * @api stable
 * @implements {SplitLayer}
 */
class OpenStreetMap extends Layer {
  static get className() { return 'vcs.vcm.layer.OpenStreetMap'; }

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
    const defaultOptions = OpenStreetMap.getDefaultOptions();
    /**
     * @type {import("@vcmap/cesium").ImagerySplitDirection}
     * @private
     */
    this._splitDirection = ImagerySplitDirection.NONE;

    if (options.splitDirection) {
      this._splitDirection = options.splitDirection === 'left' ?
        ImagerySplitDirection.LEFT :
        ImagerySplitDirection.RIGHT;
    }

    this._supportedMaps = [
      CesiumMap.className,
      Openlayers.className,
    ];

    /**
     * @type {number}
     * @private
     */
    this._opacity = parseNumberRange(options.opacity, defaultOptions.opacity, 0.0, 1.0);

    /**
     * raised if the split direction changes, is passed the split direction as its only argument
     * @type {VcsEvent<import("@vcmap/cesium").ImagerySplitDirection>}
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
   * @type {import("@vcmap/cesium").ImagerySplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {import("@vcmap/cesium").ImagerySplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        /** @type {OpenStreetMapCesium|OpenStreetMapOpenlayers} */
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
        /** @type {OpenStreetMapCesium|OpenStreetMapOpenlayers} */
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
   * @returns {Array<OpenStreetMapOpenlayers|OpenStreetMapCesium>}
   */
  createImplementationsForMap(map) {
    if (map instanceof Openlayers) {
      return [new OpenStreetMapOpenlayers(map, this.getImplementationOptions())];
    }

    if (map instanceof CesiumMap) {
      return [new OpenStreetMapCesium(map, this.getImplementationOptions())];
    }
    return [];
  }

  /**
   * @inheritDoc
   * @returns {OpenStreetMapOptions}
   */
  getConfigObject() {
    const config = /** @type {OpenStreetMapOptions} */ (super.getConfigObject());
    const defaultOptions = OpenStreetMap.getDefaultOptions();

    if (this._splitDirection !== ImagerySplitDirection.NONE) {
      config.splitDirection = this._splitDirection === ImagerySplitDirection.RIGHT ?
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

VcsClassRegistry.registerClass(OpenStreetMap.className, OpenStreetMap);
export default OpenStreetMap;
