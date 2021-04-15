import ImagerySplitDirection from 'cesium/Source/Scene/ImagerySplitDirection.js';

import { parseNumberRange, parseInteger } from '@vcs/parsers';
import Layer from './layer.js';
import Openlayers from '../maps/openlayers.js';
import CesiumMap from '../maps/cesium.js';
import OpenStreetMapOpenlayers from './openlayers/openStreetMapOpenlayers.js';
import OpenStreetMapCesium from './cesium/openStreetMapCesium.js';
import VcsEvent from '../event/vcsEvent.js';

/**
 * @typedef {vcs.vcm.layer.Layer.Options} vcs.vcm.layer.OpenStreetMap.Options
 * @property {string|undefined} splitDirection - either 'left' or 'right', if omitted none is applied
 * @property {number} [opacity=1.0] - opacity between 0 and 1
 * @property {number} [maxLevel=19] - max level to load tiles at
 * @api
 */

/**
 * OpenStreetMap Layer
 * @class
 * @export
 * @extends {vcs.vcm.layer.Layer}
 * @api stable
 * @memberOf vcs.vcm.layer
 * @implements {vcs.vcm.layer.SplitLayer}
 */
class OpenStreetMap extends Layer {
  static get className() { return 'vcs.vcm.layer.OpenStreetMap'; }

  /**
   * @returns {vcs.vcm.layer.OpenStreetMap.Options}
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
   * @param {vcs.vcm.layer.OpenStreetMap.Options} options
   */
  constructor(options) {
    super(options);
    const defaultOptions = OpenStreetMap.getDefaultOptions();
    /**
     * @type {Cesium/ImagerySplitDirection}
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
     * @type {vcs.vcm.event.VcsEvent<Cesium/ImagerySplitDirection>}
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
   * @type {Cesium/ImagerySplitDirection}
   */
  get splitDirection() { return this._splitDirection; }

  /**
   * @param {Cesium/ImagerySplitDirection} direction
   */
  set splitDirection(direction) {
    if (direction !== this._splitDirection) {
      this._splitDirection = direction;
      this.getImplementations().forEach((impl) => {
        /** @type {vcs.vcm.layer.cesium.OpenStreetMapCesium|vcs.vcm.layer.openlayers.OpenStreetMapOpenlayers} */
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
        /** @type {vcs.vcm.layer.cesium.OpenStreetMapCesium|vcs.vcm.layer.openlayers.OpenStreetMapOpenlayers} */
        (impl).updateOpacity(parsedValue);
      });
    }
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.layer.RasterLayer.ImplementationOptions}
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
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {Array<vcs.vcm.layer.openlayers.OpenStreetMapOpenlayers|vcs.vcm.layer.cesium.OpenStreetMapCesium>}
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
   * @returns {vcs.vcm.layer.OpenStreetMap.Options}
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.layer.OpenStreetMap.Options} */ (super.getConfigObject());
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

export default OpenStreetMap;
