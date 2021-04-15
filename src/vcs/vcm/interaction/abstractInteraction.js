import { v4 as uuidv4 } from 'uuid';
import { EventType, ModificationKeyType, PointerKeyType } from './interactionType.js';

/**
 * @typedef {Object} vcs.vcm.interaction.ObliqueParameters
 * @property {ol/Coordinate} pixel - the image pixel clicked
 * @property {boolean|undefined} estimate - true if the terrain could not be taken into account
 * @api
 */

/**
 * @typedef {vcs.vcm.interaction.MapEvent} vcs.vcm.interaction.Event
 * @property {vcs.vcm.interaction.EventType} type
 * @property {undefined|ol/Feature|Cesium/Cesium3DTileFeature|Cesium/Cesium3DTilePointFeature} feature - a potential feature at said location
 * @property {boolean|undefined} stopPropagation - if set to true, the event chain is interrupted
 * @property {undefined|vcs.vcm.interaction.ObliqueParameters} obliqueParameters - additional parameters from oblique if obliquemode is active
 * @property {Cesium/Ray|undefined} ray - potential ray
 * @property {boolean|undefined} exactPosition - whether the position is exact, eg with translucentDepthPicking on
 * @api
 */

/**
 * An abstract interface for all interactions
 * @class
 * @memberOf vcs.vcm.interaction
 * @export
 * @abstract
 * @api
 */
class AbstractInteraction {
  constructor() {
    /**
     * A unique identifier for this interaction
     * @type {string}
     * @api
     */
    this.id = uuidv4();

    /**
     * A bitmask representing the default events to listen to
     * {@link vcs.vcm.interaction.EventType}, default is NONE
     * @type {number}
     * @protected
     * @api
     */
    this._defaultActive = EventType.NONE;

    /**
     * The current active bitmask for {@link vcs.vcm.interaction.EventType}
     * @type {number}
     * @api
     */
    this.active = this._defaultActive;

    /**
     * The default bitmask for modification keys to listen to,
     * {@link vcs.vcm.interaction.ModificationKeyType} default is NONE
     * @type {number}
     * @protected
     * @api
     */
    this._defaultModificationKey = ModificationKeyType.NONE;

    /**
     * The current active {@link vcs.vcm.interaction.ModificationKeyType}
     * @type {number}
     * @api
     */
    this.modificationKey = this._defaultModificationKey;

    /**
     * default bitmask for pointer key {@link vcs.vcm.interaction.PointerKeyType}, starting value is LEFT
     * @type {number}
     * @protected
     */
    this._defaultPointerKey = PointerKeyType.LEFT;

    /**
     * The currently active {@link vcs.vcm.interaction.PointerKeyType}
     * @type {number}
     */
    this.pointerKey = this._defaultPointerKey;
  }

  /**
   * Main function, called when an event is raised for this interaction
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise.<vcs.vcm.interaction.Event>}
   * @api
   */
  // eslint-disable-next-line class-methods-use-this
  async pipe(event) {
    return event;
  }

  /**
   * Sets the interaction active.
   * Use boolean (true|false) to toggle default behavior.
   * Pass it a bitmask of {@link vcs.vcm.interaction.EventType}
   * to change the active state.
   * Call without arguments to reset the default active, modification key and pointer Key behavior
   * @param {(boolean|number)=} active
   * @api
   */
  setActive(active) {
    if (typeof active === 'undefined') {
      this.active = this._defaultActive;
      this.modificationKey = this._defaultModificationKey;
      this.pointerKey = this._defaultPointerKey;
    } else if (typeof active === 'boolean') {
      this.active = active ? this._defaultActive : EventType.NONE;
    } else {
      this.active = active;
    }
  }

  /**
   * Sets the modification key to listen to
   * @param {number=} mod
   * @api
   */
  setModification(mod) {
    if (mod) {
      this.modificationKey = mod;
    } else {
      this.modificationKey = this._defaultModificationKey;
    }
  }

  /**
   * Sets the pointer key for this interaction$
   * @param {number} pointer
   * @api
   */
  setPointer(pointer) {
    if (pointer) {
      this.pointerKey = pointer;
    } else {
      this.pointerKey = this._defaultPointerKey;
    }
  }

  /**
   * destroys the implementation, removing any created resources
   */
  // eslint-disable-next-line class-methods-use-this
  destroy() {}
}

export default AbstractInteraction;
