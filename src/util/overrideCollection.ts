import { check } from '@vcsuite/check';
import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import Collection from './collection.js';
import VcsEvent from '../vcsEvent.js';
import { moduleIdSymbol } from '../moduleIdSymbol.js';

function getLogger(): Logger {
  return getLoggerByName('OverrideCollection');
}

export interface ReplacedEvent<T> {
  new: T;
  old: T;
}

/**
 * A symbol added to override collections.
 */
export const isOverrideCollection: unique symbol = Symbol('OverrideCollection');

export type OverrideCollectionItem = {
  toJSON?: () => object & { [moduleIdSymbol]?: string };
  destroy?: () => void;
  [moduleIdSymbol]?: string;
} & object;

/**
 * The override collection adds the ability to override a unique item and re-creating it, should the override
 * be removed. This does change some flow of called events. 1) if you override an item, removed is not called for the
 * removed current item. 2) added can be called more the once for the same unique id. 3) replaced is called for items
 * which where replaced. replaced is called after added has been called for the item.
 */
export type OverrideCollectionInterface<T> = {
  /**
   * replaced is called after added
   */
  replaced: VcsEvent<ReplacedEvent<T>>;
  shadowMap: Map<string, (object & { [moduleIdSymbol]?: string })[]>;
  /**
   * returns the overriden item or null if the item could not be inserted (this would be the result of a race condition)
   */
  override: (item: T) => T | null;
  parseItems: (
    items: (object & { type?: string })[] | undefined,
    moduleId: string,
  ) => Promise<void>;
  getSerializedByKey: (key: string) => object | undefined;
  removeModule: (moduleId: string) => void;
  serializeModule: (moduleId: string) => object[];
  [isOverrideCollection]: boolean;
  uniqueKey: keyof T;
};

export type OverrideCollection<
  T extends OverrideCollectionItem,
  C extends Collection<T> = Collection<T>,
> = C & OverrideCollectionInterface<T>;

/**
 * @param  collection
 * @param  getDynamicModuleId - function to get the current dynamic module id
 * @param  serializeItem - optional function to serialize an item, defaults to returning item.toJSON or item: i => (i.toJSON || i)
 * @param  deserializeItem - optional deserialization function. defaults to returning the passed object: i => i
 * @param  ctor - optional constructor to validate deserialized items against. if passed, deserializeItem must be an instance of ctor.
 * @param  determineShadowIndex - return the index where a shadow should be inserted. only has relevance, if the collection is indexed. previous and current index may be null.
 */
function makeOverrideCollection<
  T extends OverrideCollectionItem,
  C extends Collection<T>,
>(
  collection: C,
  getDynamicModuleId: () => string,
  serializeItem?: (item: T) => object & { [moduleIdSymbol]?: string },
  deserializeItem?: (item: object) => T | Promise<T> | null,
  ctor?: new (...args: any[]) => T,
  determineShadowIndex?: (
    item: T,
    shadow?: T,
    index?: number,
  ) => number | null | undefined,
): OverrideCollection<T, C> {
  check(collection, Collection);

  const overrideCollection = collection as OverrideCollection<T, C>;
  if (overrideCollection[isOverrideCollection]) {
    throw new Error(
      'Cannot transform collection, collection already is an OverrideCollection',
    );
  }
  overrideCollection[isOverrideCollection] = true;

  const deserialize = deserializeItem || ((i: object): T => i as T);
  const serialize =
    serializeItem ||
    ((i: T): object & { [moduleIdSymbol]?: string } =>
      i.toJSON ? i.toJSON() : i);
  const getShadowIndex =
    determineShadowIndex ||
    ((
      _item: T,
      _shadow?: T | null,
      currentIndex?: number,
    ): number | null | undefined => currentIndex);

  overrideCollection.shadowMap = new Map();

  overrideCollection.override = function override(item: T): T | null {
    let shadow;
    let index;
    const itemId = item[overrideCollection.uniqueKey] as string;

    if (overrideCollection.hasKey(itemId)) {
      shadow = overrideCollection.getByKey(itemId) as T;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      index = overrideCollection._remove(shadow);

      if (!overrideCollection.shadowMap.has(itemId)) {
        overrideCollection.shadowMap.set(itemId, []);
      }
      const shadowsArray = overrideCollection.shadowMap.get(itemId) as object[];
      const serializedShadow = serialize(shadow);
      serializedShadow[moduleIdSymbol] = shadow[moduleIdSymbol];
      shadowsArray.push(serializedShadow);
    }

    const usedIndex = shadow ? getShadowIndex(shadow, item, index) : null;
    if (shadow) {
      overrideCollection.replaced.raiseEvent({ old: shadow, new: item });
      if (shadow.destroy) {
        shadow.destroy();
      }
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if ((overrideCollection.add(item, usedIndex) as number) >= 0) {
      return item;
    }
    return null;
  };

  overrideCollection.parseItems = async function parseItems(
    configArray,
    moduleId,
  ): Promise<void> {
    if (Array.isArray(configArray)) {
      const instanceArray = await Promise.all(
        configArray.map(async (config) => {
          const item = await deserialize(config);
          if (!item || (ctor && !(item instanceof ctor))) {
            getLogger().warning(
              `Could not load item ${
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                String(config[overrideCollection.uniqueKey])
              } of type ${String(config.type)}`,
            );
            return null;
          }
          item[moduleIdSymbol] = moduleId;
          return item;
        }),
      );
      instanceArray
        .filter((i) => i)
        .forEach((i) => {
          overrideCollection.override(i as T);
        });
    }
  };

  overrideCollection.getSerializedByKey = function getSerializedByKey(
    key,
  ): object | undefined {
    const item = overrideCollection.getByKey(key);
    if (item) {
      return serialize(item);
    }
    return undefined;
  };

  overrideCollection.removed.addEventListener(
    async (item: T): Promise<void> => {
      const itemId = item[overrideCollection.uniqueKey] as string;

      if (overrideCollection.shadowMap.has(itemId)) {
        const serializedShadow = overrideCollection.shadowMap
          .get(itemId)!
          .pop();
        if (serializedShadow) {
          const reincarnation = await deserialize(serializedShadow);
          if (!reincarnation) {
            getLogger().error('failed to deserialize item');
            return;
          }
          reincarnation[moduleIdSymbol] = serializedShadow[
            moduleIdSymbol
          ] as string;
          const index = getShadowIndex(
            reincarnation,
            item,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            item[overrideCollection.previousIndexSymbol] as number,
          );
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          overrideCollection.add(reincarnation, index);
        }

        if (overrideCollection.shadowMap.get(itemId)?.length === 0) {
          overrideCollection.shadowMap.delete(itemId);
        }
      }
    },
  );

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore // problem with listener type and generic
  overrideCollection.added.addEventListener((item: T): void => {
    if (!item[moduleIdSymbol]) {
      item[moduleIdSymbol] = getDynamicModuleId();
    }
  });

  overrideCollection.removeModule = function removeModule(moduleId): void {
    overrideCollection.shadowMap.forEach((shadowsArray, name) => {
      const newShadowsArray = shadowsArray.filter(
        (c) => c[moduleIdSymbol] !== moduleId,
      );
      if (newShadowsArray.length === 0) {
        overrideCollection.shadowMap.delete(name);
      } else if (newShadowsArray.length !== shadowsArray.length) {
        overrideCollection.shadowMap.set(name, newShadowsArray);
      }
    });

    [...overrideCollection]
      .filter((item) => item[moduleIdSymbol] === moduleId)
      .forEach((item): void => {
        overrideCollection.remove(item);
        if (item.destroy) {
          item.destroy();
        }
      });
  };

  overrideCollection.replaced = new VcsEvent();

  /**
   * @param {string} moduleId
   * @returns {Object[]}
   */
  overrideCollection.serializeModule = function serializeModule(
    moduleId,
  ): object[] {
    return [...overrideCollection]
      .map((item) => {
        if (item[moduleIdSymbol] === moduleId) {
          return serialize(item);
        }
        const itemId = item[overrideCollection.uniqueKey] as string;
        if (overrideCollection.shadowMap.has(itemId)) {
          const array = overrideCollection.shadowMap.get(itemId);
          return array!.find((i) => i[moduleIdSymbol] === moduleId);
        }
        return null;
      })
      .filter((i) => i) as object[];
  };

  const originalDestroy = overrideCollection.destroy.bind(overrideCollection);

  overrideCollection.destroy = function destroy(): void {
    originalDestroy();
    overrideCollection.shadowMap.clear();
    overrideCollection.replaced.destroy();
  };

  return overrideCollection;
}

export default makeOverrideCollection;
