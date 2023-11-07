import type GlobalHider from '../layer/globalHider.js';
import makeOverrideCollection, {
  OverrideCollection,
} from './overrideCollection.js';
import Collection from './collection.js';

export type HiddenObject = {
  id: string;
};

export function createHiddenObjectsCollection(
  getDynamicModuleId: () => string,
  globalHider: GlobalHider,
): OverrideCollection<HiddenObject> {
  const collection = makeOverrideCollection<
    HiddenObject,
    Collection<HiddenObject>
  >(new Collection<HiddenObject>('id'), getDynamicModuleId);

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
