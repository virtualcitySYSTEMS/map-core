import { check } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';

/**
 * @class
 * @api
 */
class ClassRegistry {
  constructor() {
    /**
     * @type {Map<string, function():(function(new: *, ...*)|Promise<function(new: *, ...*)>)>}
     * @private
     */
    this._classMap = new Map();
    /**
     * @type {import("@vcsuite/logger").Logger}
     */
    this.logger = getLogger('vcs.vcm.ClassRegistry');
  }

  /**
   * Register a class by its class name.
   * @param {string} className
   * @param {function(new: *, ...*)} ctor
   * @api
   */
  registerClass(className, ctor) {
    check(className, String);
    check(ctor, Function);

    if (this._classMap.has(className)) {
      throw new Error('a constructor with this className has already been registered');
    }

    this._classMap.set(className, () => ctor);
  }

  /**
   * @param {string} className
   * @param {function():Promise<function(new: *, ...*)>} cb - a callback providing a promise which returns the constructor on resolve.
   * used for lazy loading modules, e.g
   * <code>ClassRegistry.registerDeferredClass(() => import('my-module').then(({ default: MyCtor }) => MyCtor));</code>
   * @api
   */
  registerDeferredClass(className, cb) {
    check(className, String);
    check(cb, Function);

    this._classMap.set(className, cb);
  }

  /**
   * Gets the constructor for a registered class or undefined, if no such class was registerd
   * @param {string} className
   * @returns {function(new: *, ...*)|Promise<*>|undefined}
   * @api
   */
  getClass(className) {
    if (this._classMap.has(className)) {
      return this._classMap.get(className)();
    }
    return undefined;
  }

  /**
   * @param {string} className
   * @param {...*} args
   * @returns {Promise<*>}
   * @api
   */
  async create(className, ...args) {
    check(className, String);

    const Ctor = await this.getClass(className);
    if (!Ctor) {
      this.logger.error(`could not find constructor ${className}`);
      return undefined;
    }
    return new Ctor(...args);
  }

  /**
   * @param {string} className
   * @param {...*} args
   * @returns {*}
   * @deprecated 4.0
   */
  createSync(className, ...args) {
    check(className, String);

    const Ctor = /** @type {function(new: *, ...*)} */ (this.getClass(className));
    if (!Ctor) {
      this.logger.error(`could not find constructor ${className}`);
      return undefined;
    }
    return new Ctor(...args);
  }
}

export default ClassRegistry;

/**
 * @export
 * @type {ClassRegistry}
 */
export const VcsClassRegistry = new ClassRegistry();
