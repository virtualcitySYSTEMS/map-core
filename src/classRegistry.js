import { is, check } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import OverrideClassRegistry from './overrideClassRegistry.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function logger() {
  return getLogger('ClassRegistry');
}

/**
 * @class
 * @api
 * @template {Object|import("@vcmap/core").VcsObject} T
 */
class ClassRegistry {
  constructor() {
    /**
     * @type {Map<string, function(new: T, ...*)>}
     * @private
     */
    this._classMap = new Map();
  }

  /**
   * @returns {Array<string>}
   */
  getClassNames() {
    return [...this._classMap.keys()];
  }

  /**
   * Register a class by its class name.
   * @param {string} className
   * @param {function(new: T, ...*)} ctor
   * @api
   */
  registerClass(className, ctor) {
    check(className, String);
    check(ctor, Function);

    if (this._classMap.has(className)) {
      throw new Error('a constructor with this className has already been registered');
    }

    this._classMap.set(className, ctor);
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
      return this._classMap.get(className);
    }
    return undefined;
  }

  /**
   * @param {string} className
   * @returns {boolean}
   */
  hasClass(className) {
    check(className, String);

    return this._classMap.has(className);
  }

  /**
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
   * @param {Object} options
   * @param {...*} args
   * @returns {T}
   */
  createFromTypeOptions(options, ...args) {
    check(options, { type: String });

    return this.create(options.type, options, ...args);
  }
}

export default ClassRegistry;

/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").Layer>}
 */
export const layerClassRegistry = new ClassRegistry();
/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").TileProvider>}
 */
export const tileProviderClassRegistry = new ClassRegistry();
/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").AbstractFeatureProvider>}
 */
export const featureProviderClassRegistry = new ClassRegistry();
/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").VcsMap>}
 */
export const mapClassRegistry = new ClassRegistry();
/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").StyleItem>}
 */
export const styleClassRegistry = new ClassRegistry();
/**
 * @export
 * @type {ClassRegistry<import("@vcmap/core").Category<*>>}
 */
export const categoryClassRegistry = new ClassRegistry();

/**
 * Returns an object based on a class registry or override class registry and a typed options object. as opposed to ClassRegistry.createFromTypedOptions, this function never throws.
 * @api stable
 * @template {Object|import("@vcmap/core").VcsObject} T
 * @param {OverrideClassRegistry<T>|ClassRegistry<T>} classRegistry
 * @param {Object} options
 * @param {...*} args
 * @returns {T|null}
 */
export function getObjectFromClassRegistry(classRegistry, options, ...args) { // move to classReg
  if (!is(classRegistry, [ClassRegistry, OverrideClassRegistry])) {
    logger().error(`ObjectCreation failed: no class registry provided for ${options}`);
    return null;
  }

  if (!options?.type) {
    logger().warning(`ObjectCreation failed: could not find type in options ${options}`);
    return null;
  }
  let object;
  try {
    object = classRegistry.createFromTypeOptions(options, ...args);
  } catch (ex) {
    logger().warning(`Error: ${ex}`);
  }

  if (!object) {
    logger().warning('ObjectCreation failed: could not create new Object');
    return null;
  }
  return object;
}
