import { check } from '@vcsuite/check';
import { getLogger, type Logger } from '@vcsuite/logger';
import VcsEvent from './vcsEvent.js';
import {
  // eslint-disable-next-line import/no-named-default
  default as ClassRegistry,
  Ctor,
  AbstractCtor,
} from './classRegistry.js';

function logger(): Logger {
  return getLogger('OverrideClassRegistry');
}

type ModuleEntry<T extends AbstractCtor> = { moduleId: string; ctor: Ctor<T> };

class OverrideClassRegistry<T extends AbstractCtor> {
  private _coreClassRegistry: ClassRegistry<T>;

  private _classMap: Map<string, ModuleEntry<T>> = new Map();

  private _classShadows: Map<string, ModuleEntry<T>[]> = new Map();

  /**
   * Called if a class was replaced. Is passed the className
   */
  replaced: VcsEvent<string> = new VcsEvent();

  /**
   * Called if a class was removed. Is passed the className
   */
  removed: VcsEvent<string> = new VcsEvent();

  constructor(coreClassRegistry: ClassRegistry<T>) {
    this._coreClassRegistry = coreClassRegistry;
  }

  getClassNames(): string[] {
    return [
      ...new Set([
        ...this._classMap.keys(),
        ...this._coreClassRegistry.getClassNames(),
      ]),
    ];
  }

  /**
   * Register a class for a given module by name. If the class already exists, it will be replaced and replaced called with the classeName.
   */
  registerClass(moduleId: string, className: string, ctor: Ctor<T>): void {
    check(moduleId, String);
    check(className, String);
    check(ctor, Function);

    const entry = {
      moduleId,
      ctor,
    };

    const replaced = this.hasClass(className);

    if (this._classMap.has(className)) {
      if (!this._classShadows.has(className)) {
        this._classShadows.set(className, []);
      }
      this._classShadows
        .get(className)!
        .push(this._classMap.get(className) as ModuleEntry<T>);
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
   */
  unregisterClass(moduleId: string, className: string): void {
    check(moduleId, String);
    check(className, String);

    if (this._classShadows.has(className)) {
      const shadowsArray = this._classShadows.get(
        className,
      ) as ModuleEntry<T>[];
      const newShadowsArray = shadowsArray.filter(
        (e) => e.moduleId !== moduleId,
      );
      if (newShadowsArray.length === 0) {
        this._classShadows.delete(className);
      } else if (newShadowsArray.length !== shadowsArray.length) {
        this._classShadows.set(className, newShadowsArray);
      }
    }

    if (
      this._classMap.has(className) &&
      this._classMap.get(className)!.moduleId === moduleId
    ) {
      this._classMap.delete(className);
      if (this._classShadows.has(className)) {
        this._classMap.set(
          className,
          this._classShadows.get(className)!.pop() as ModuleEntry<T>,
        );
        if (this._classShadows.get(className)!.length === 0) {
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
   */
  getClass(className: string): Ctor<T> | undefined {
    check(className, String);

    if (this._classMap.has(className)) {
      return this._classMap.get(className)!.ctor;
    }
    return this._coreClassRegistry.getClass(className);
  }

  hasClass(className: string): boolean {
    check(className, String);

    return (
      this._classMap.has(className) ||
      this._coreClassRegistry.hasClass(className)
    );
  }

  /**
   * Create an object of the given className. The constructor is passed args.
   */
  create(className: string, ...args: unknown[]): InstanceType<T> | undefined {
    check(className, String);

    const Constructor = this.getClass(className);
    if (!Constructor) {
      logger().error(`could not find constructor ${className}`);
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new Constructor(...args);
  }

  /**
   * A convenience API to pass in a serialized VcsObject directly. It calls create using options.type as the className.
   * Will throw an error if options.type is not a string or options is not an Object.
   * Passes options and args to the constructor in that order.
   */
  createFromTypeOptions(
    options: { type?: string } & Record<string, unknown>,
    ...args: unknown[]
  ): InstanceType<T> | undefined {
    check(options, { type: String });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.create(options.type as string, options, ...args);
  }

  /**
   * Removes all classes registered from within a certain module. Will re-instate classes overwritten by the module
   * and call the appropriate events, outlined in unregisterClass.
   */
  removeModule(moduleId: string): void {
    check(moduleId, String);

    this._classMap.forEach((_cb, className) => {
      this.unregisterClass(moduleId, className);
    });
  }

  /**
   * Destroys the override class registry
   */
  destroy(): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._coreClassRegistry = undefined;
    this._classMap.clear();
    this._classShadows.clear();
    this.replaced.destroy();
    this.removed.destroy();
  }
}

export default OverrideClassRegistry;
