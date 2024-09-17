import { is, check, oneOf } from '@vcsuite/check';
import { getLogger, type Logger } from '@vcsuite/logger';
import OverrideClassRegistry from './overrideClassRegistry.js';
import type Layer from './layer/layer.js';
import type VcsMap from './map/vcsMap.js';
import type StyleItem from './style/styleItem.js';
import type Category from './category/category.js';
import type AbstractFeatureProvider from './featureProvider/abstractFeatureProvider.js';
import type TileProvider from './layer/tileProvider/tileProvider.js';

function logger(): Logger {
  return getLogger('ClassRegistry');
}

export type AbstractCtor = new (...args: any) => any;

export type Ctor<T extends AbstractCtor> = new (
  ...params: any
) => InstanceType<T>;

export type TypedConstructorOptions = { type?: string } & Record<
  string,
  unknown
>;

class ClassRegistry<T extends AbstractCtor> {
  private _classMap: Map<string, Ctor<T>>;

  constructor() {
    this._classMap = new Map();
  }

  getClassNames(): string[] {
    return [...this._classMap.keys()];
  }

  /**
   * Register a class by its class name.
   * @param  className
   * @param  ctor
   */
  registerClass(className: string, ctor: Ctor<T>): void {
    check(className, String);
    check(ctor, Function);

    if (this._classMap.has(className)) {
      throw new Error(
        'a constructor with this className has already been registered',
      );
    }

    this._classMap.set(className, ctor);
  }

  /**
   * Gets the constructor for a registered class or undefined, if no such class was registerd
   */
  getClass(className: string): Ctor<T> | undefined {
    check(className, String);

    if (this._classMap.has(className)) {
      return this._classMap.get(className);
    }
    return undefined;
  }

  hasClass(className: string): boolean {
    check(className, String);

    return this._classMap.has(className);
  }

  create(className: string, ...args: unknown[]): InstanceType<T> | undefined {
    check(className, String);

    const Ctor = this.getClass(className);
    if (!Ctor) {
      logger().error(`could not find constructor ${className}`);
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new Ctor(...args);
  }

  createFromTypeOptions(
    options: TypedConstructorOptions,
    ...args: unknown[]
  ): InstanceType<T> | undefined {
    check(options, { type: String });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.create(options.type as string, options, ...args);
  }
}

export default ClassRegistry;

export const layerClassRegistry: ClassRegistry<typeof Layer> =
  new ClassRegistry();

export const tileProviderClassRegistry: ClassRegistry<typeof TileProvider> =
  new ClassRegistry();

export const featureProviderClassRegistry: ClassRegistry<
  typeof AbstractFeatureProvider
> = new ClassRegistry();

export const mapClassRegistry: ClassRegistry<typeof VcsMap> =
  new ClassRegistry();

export const styleClassRegistry: ClassRegistry<typeof StyleItem> =
  new ClassRegistry();

export const categoryClassRegistry: ClassRegistry<typeof Category<any, any>> =
  new ClassRegistry();

/**
 * Returns an object based on a class registry or override class registry and a typed options object. as opposed to ClassRegistry.createFromTypedOptions, this function never throws.
 */
export function getObjectFromClassRegistry<T extends Ctor<T>>(
  classRegistry: OverrideClassRegistry<T> | ClassRegistry<T>,
  options: TypedConstructorOptions,
  ...args: unknown[]
): InstanceType<T> | null {
  // move to classReg
  if (!is(classRegistry, oneOf(ClassRegistry, OverrideClassRegistry))) {
    logger().error(
      `ObjectCreation failed: no class registry provided for ${String(
        options.type,
      )}`,
    );
    return null;
  }

  if (!options?.type) {
    logger().warning('ObjectCreation failed: could not find type in options');
    return null;
  }
  let object;
  try {
    object = classRegistry.createFromTypeOptions(options, ...args);
  } catch (ex) {
    logger().warning(`Error: ${String(ex)}`);
  }

  if (!object) {
    logger().warning('ObjectCreation failed: could not create new Object');
    return null;
  }
  return object as InstanceType<T>;
}
