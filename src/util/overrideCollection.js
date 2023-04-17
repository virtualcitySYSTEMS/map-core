/* eslint no-underscore-dangle: ["error", { "allow": ["_array"] }] */
// eslint-disable-next-line max-classes-per-file
import { check } from '@vcsuite/check';
import { getLogger as getLoggerByName } from '@vcsuite/logger';
import { moduleIdSymbol } from '../vcsModuleHelpers.js';
import Collection from './collection.js';
import VcsEvent from '../vcsEvent.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('OverrideCollection');
}

/**
 * The override collection adds the ability to override a unique item and re-creating it, should the override
 * be removed. This does change some flow of called events. 1) if you override an item, removed is not called for the
 * removed current item. 2) added can be called more the once for the same unique id. 3) replaced is called for items
 * which where replaced. replaced is called after added has been called for the item.
 * @interface OverrideCollectionInterface
 * @property {import("@vcmap/core").VcsEvent<T>} replaced - replaced is called after added
 * @property {function(T):T|null} override - returns the overriden item or null if the item could not be inserted (this would be the result of a race condition)
 * @property {Map<string, Array<Object>>} shadowMap
 * @property {function(Array<Object>, string):Promise<void>} parseItems
 * @property {function(string):Object} getSerializedByKey
 * @property {function(string):Promise<void>} removeModule
 * @property {function(string):Array<Object>} serializeModule
 * @template {*} T
 */

/**
 * A symbol added to override collections.
 * @type {symbol}
 */
export const isOverrideCollection = Symbol('OverrideCollection');

/**
 * @param {Collection<T>} collection
 * @param {function():string} getDynamicModuleId - function to get the current dynamic module id
 * @param {(function(T):Object)=} serializeItem - optional function to serialize an item, defaults to returning item.toJSON or item: i => (i.toJSON || i)
 * @param {(function(Object):(T|Promise<T>))=} deserializeItem - optional deserialization function. defaults to returning the passed object: i => i
 * @param {*=} ctor - optional constructor to validate deserialized items against. if passed, deserializeItem must be an instance of ctor.
 * @param {(function(T, (T|null|undefined), (number|undefined)):number|null)=} determineShadowIndex - return the index where a shadow should be inserted. only has relevance, if the collection is indexed. previous and current index may be null.
 * @template {*} T
 * @returns {OverrideCollection<T>}
 */
function makeOverrideCollection(
  collection,
  getDynamicModuleId,
  serializeItem,
  deserializeItem,
  ctor,
  determineShadowIndex,
) {
  check(collection, Collection);

  const overrideCollection = /** @type {OverrideCollection<T>} */ (collection);
  if (overrideCollection[isOverrideCollection]) {
    throw new Error(
      'Cannot transform collection, collection already is an OverrideCollection',
    );
  }
  overrideCollection[isOverrideCollection] = true;

  const deserialize = deserializeItem || ((i) => i);
  // @ts-ignore
  const serialize = serializeItem || ((i) => (i.toJSON ? i.toJSON() : i));
  const getShadowIndex =
    determineShadowIndex || ((item, shadow, currentIndex) => currentIndex);

  /**
   * @type {Map<string, Array<Object>>}
   */
  overrideCollection.shadowMap = new Map();

  /**
   * @param {T} item
   * @returns {T|null}
   */
  overrideCollection.override = function override(item) {
    let shadow;
    let index;
    const itemId = item[overrideCollection.uniqueKey];

    if (overrideCollection.hasKey(itemId)) {
      shadow = overrideCollection.getByKey(itemId);

      // @ts-ignore
      // eslint-disable-next-line no-underscore-dangle
      index = overrideCollection._remove(shadow);

      if (!overrideCollection.shadowMap.has(itemId)) {
        overrideCollection.shadowMap.set(itemId, []);
      }
      const shadowsArray = overrideCollection.shadowMap.get(itemId);
      const serializedShadow = serialize(shadow);
      serializedShadow[moduleIdSymbol] = shadow[moduleIdSymbol];
      shadowsArray.push(serializedShadow);
    }

    const usedIndex = shadow ? getShadowIndex(shadow, item, index) : null;
    if (shadow) {
      overrideCollection.replaced.raiseEvent({ old: shadow, new: item });
      // @ts-ignore
      if (shadow.destroy) {
        // @ts-ignore
        shadow.destroy();
      }
    }
    // @ts-ignore
    if (overrideCollection.add(item, usedIndex) >= 0) {
      return item;
    }
    return null;
  };

  /**
   * @param {Array<Object>} configArray
   * @param {string} moduleId
   * @returns {Promise<void>}
   */
  overrideCollection.parseItems = async function parseItems(
    configArray,
    moduleId,
  ) {
    if (Array.isArray(configArray)) {
      const instanceArray = await Promise.all(
        configArray.map(async (config) => {
          const item = await deserialize(config);
          if (!item || (ctor && !(item instanceof ctor))) {
            getLogger().warning(
              `Could not load item ${
                config[overrideCollection.uniqueKey]
              } of type ${config.type}`,
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
          overrideCollection.override(i);
        });
    }
  };

  /**
   * @param {string} key
   * @returns {Object|undefined}
   */
  overrideCollection.getSerializedByKey = function getSerializedByKey(key) {
    const item = overrideCollection.getByKey(key);
    if (item) {
      return serialize(item);
    }
    return undefined;
  };

  overrideCollection.removed.addEventListener(async (item) => {
    const itemId = item[overrideCollection.uniqueKey];

    if (overrideCollection.shadowMap.has(itemId)) {
      const serializedShadow = overrideCollection.shadowMap.get(itemId).pop();
      if (serializedShadow) {
        const reincarnation = await deserialize(serializedShadow);
        reincarnation[moduleIdSymbol] = serializedShadow[moduleIdSymbol];
        const index = getShadowIndex(
          reincarnation,
          item,
          // @ts-ignore
          item[overrideCollection.previousIndexSymbol],
        );
        // @ts-ignore
        overrideCollection.add(reincarnation, index);
      }

      if (overrideCollection.shadowMap.get(itemId).length === 0) {
        overrideCollection.shadowMap.delete(itemId);
      }
    }
  });

  overrideCollection.added.addEventListener((item) => {
    if (!item[moduleIdSymbol]) {
      item[moduleIdSymbol] = getDynamicModuleId();
    }
  });

  /**
   * @param {string} moduleId
   * @returns {Promise<void>}
   */
  overrideCollection.removeModule = async function removeModule(moduleId) {
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

    await Promise.all(
      [...overrideCollection]
        .filter((item) => item[moduleIdSymbol] === moduleId)
        .map(async (item) => {
          overrideCollection.remove(item);
          // @ts-ignore
          if (item.destroy) {
            // @ts-ignore
            item.destroy();
          }
        }),
    );
  };

  /**
   * @type {VcsEvent<ReplacedEvent<T>>}
   */
  overrideCollection.replaced = new VcsEvent();

  /**
   * @param {string} moduleId
   * @returns {Array<Object>}
   */
  overrideCollection.serializeModule = function serializeModule(moduleId) {
    return [...overrideCollection]
      .map((item) => {
        if (item[moduleIdSymbol] === moduleId) {
          return serialize(item);
        }
        if (
          overrideCollection.shadowMap.has(item[overrideCollection.uniqueKey])
        ) {
          return overrideCollection.shadowMap
            .get(item[overrideCollection.uniqueKey])
            .find((i) => i[moduleIdSymbol] === moduleId);
        }
        return null;
      })
      .filter((i) => i);
  };

  const originalDestroy = overrideCollection.destroy.bind(overrideCollection);

  overrideCollection.destroy = function destroy() {
    originalDestroy();
    overrideCollection.shadowMap.clear();
    overrideCollection.replaced.destroy();
  };

  return overrideCollection;
}

export default makeOverrideCollection;
