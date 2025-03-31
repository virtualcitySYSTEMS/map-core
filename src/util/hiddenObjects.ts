import type GlobalHider from '../layer/globalHider.js';
import type { OverrideCollection } from './overrideCollection.js';
import makeOverrideCollection from './overrideCollection.js';
import Collection from './collection.js';
import type { moduleIdSymbol } from '../moduleIdSymbol.js';

export type HiddenObject = {
  id: string;
  [moduleIdSymbol]?: string;
};

export function createHiddenObjectsCollection(
  getDynamicModuleId: () => string,
  globalHider: GlobalHider,
): OverrideCollection<HiddenObject> {
  const collection = makeOverrideCollection<HiddenObject>(
    new Collection<HiddenObject>('id'),
    getDynamicModuleId,
  );

  collection.added.addEventListener(({ id }) => {
    globalHider.hideObjects([id]);
  });

  collection.replaced.addEventListener(({ new: item }) => {
    globalHider.showObjects([item.id]);
  });

  collection.removed.addEventListener(({ id }) => {
    globalHider.showObjects([id]);
  });

  return collection;
}
