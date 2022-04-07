import { check } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import VcsEvent from './vcsEvent.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function logger() {
  return getLogger('OverrideClassRegistry');
}

/**
 * @class
 * @template {Object|import("@vcmap/core").VcsObject} T
 */
class OverrideClassRegistry {
  /**
   * @param {import("@vcmap/core").ClassRegistry<T>} coreClassRegistry
   */
  constructor(coreClassRegistry) {
    this._coreClassRegistry = coreClassRegistry;
    /**
     * @type {Map<string, { contextId: string, ctor: function(new: T, ...*) }>}
     * @private
     */
    this._classMap = new Map();
    /**
     * @type {Map<string, Array<{ contextId: string, ctor: function(new: T, ...*) }>>}
     * @private
     */
    this._classShadows = new Map();
    /**
     * Called if a class was replaced. Is passed the className
     * @type {VcsEvent<string>}
     */
    this.replaced = new VcsEvent();
    /**
     * Called if a class was removed. Is passed the className
     * @type {VcsEvent<string>}
     */
    this.removed = new VcsEvent();
  }

  /**
   * @returns {Array<string>}
   */
  getClassNames() {
    return [...new Set([...this._classMap.keys(), ...this._coreClassRegistry.getClassNames()])];
  }

  /**
   * Register a class for a given context by name. If the class already exists, it will be replaced and replaced called with the classeName.
   * @param {string} contextId
   * @param {string} className
   * @param {function(new: T, ...*)} ctor
   */
  registerClass(contextId, className, ctor) {
    check(contextId, String);
    check(className, String);
    check(ctor, Function);

    const entry = {
      contextId,
      ctor,
    };

    const replaced = this.hasClass(className);

    if (this._classMap.has(className)) {
      if (!this._classShadows.has(className)) {
        this._classShadows.set(className, []);
      }
      this._classShadows.get(className).push(this._classMap.get(className));
    }
    this._classMap.set(className, entry);

    if (replaced) {
      this.replaced.raiseEvent(className);
    }
  }

  /**
   * Unregister a previously registered class. You can only unregister classes added to this registry, not the underlying core registry.
   * If when registering this class you have replaced class, it will be re-instated and replaced called.
   * If there is no previously registered class, it will be removed and removed will be called.
   * @param {string} contextId
   * @param {string} className
   */
  unregisterClass(contextId, className) {
    check(contextId, String);
    check(className, String);

    if (this._classShadows.has(className)) {
      const shadowsArray = this._classShadows.get(className);
      const newShadowsArray = shadowsArray.filter(e => e.contextId !== contextId);
      if (newShadowsArray.length === 0) {
        this._classShadows.delete(className);
      } else if (newShadowsArray.length !== shadowsArray.length) {
        this._classShadows.set(className, newShadowsArray);
      }
    }

    if (
      this._classMap.has(className) &&
      this._classMap.get(className).contextId === contextId
    ) {
      this._classMap.delete(className);
      if (this._classShadows.has(className)) {
        this._classMap.set(className, this._classShadows.get(className).pop());
        if (this._classShadows.get(className).length === 0) {
          this._classShadows.delete(className);
        }
        this.replaced.raiseEvent(className);
      } else if (this._coreClassRegistry.hasClass(className)) {
        this.replaced.raiseEvent(className);
      } else {
        this.removed.raiseEvent(className);
      }
    }
  }

  /**
   * Gets the constructor for a registered class or undefined, if no such class was registerd
   * @param {string} className
   * @returns {function(new: T, ...*)|undefined}
   * @api
   */
  getClass(className) {
    check(className, String);

    if (this._classMap.has(className)) {
      return this._classMap.get(className).ctor;
    }
    return this._coreClassRegistry.getClass(className);
  }

  /**
   * @param {string} className
   * @returns {boolean}
   */
  hasClass(className) {
    check(className, String);

    return this._classMap.has(className) || this._coreClassRegistry.hasClass(className);
  }

  /**
   * Create an object of the given className. The constructor is passed args.
   * @param {string} className
   * @param {...*} args
   * @returns {T}
   * @api
   */
  create(className, ...args) {
    check(className, String);

    const Ctor = this.getClass(className);
    if (!Ctor) {
      logger().error(`could not find constructor ${className}`);
      return undefined;
    }
    return new Ctor(...args);
  }

  /**
   * A convenience API to pass in a serialized VcsObject directly. It calls create using options.type as the className.
   * Will throw an error if options.type is not a string or options is not an Object.
   * Passes options and args to the constructor in that order.
   * @param {Object} options
   * @param {...*} args
   * @returns {T}
   */
  createFromTypeOptions(options, ...args) {
    check(options, { type: String });

    return this.create(options.type, options, ...args);
  }

  /**
   * Removes all classes registered from within a certain context. Will re-instate classes overwritten by the context
   * and call the appropriate events, outlined in unregisterClass.
   * @param {string} contextId
   */
  removeContext(contextId) {
    check(contextId, String);

    this._classMap.forEach((cb, className) => {
      this.unregisterClass(contextId, className);
    });
  }

  /**
   * Destroys the override class registry
   */
  destroy() {
    this._coreClassRegistry = null;
    this._classMap.clear();
    this._classShadows.clear();
    this.replaced.destroy();
    this.removed.destroy();
  }
}

export default OverrideClassRegistry;
