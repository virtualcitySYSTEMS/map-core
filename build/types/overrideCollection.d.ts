import {
  Collection,
  VcsEvent,
  LayerCollection,
  Layer,
  MapCollection,
  VcsMap,
} from '@vcmap/core';

export interface ReplacedEvent<T extends any> {
  new: T;
  old: T;
}

export interface OverrideCollectionInterface<T extends any> {
  replaced: VcsEvent<ReplacedEvent<T>>;
  shadowMap: Map<string, object[]>;
  override: (item: T) => T;
  parseItems: (items: object[], moduleId: string) => Promise<void>;
  getSerializedByKey: (key: string) => object;
  removeModule: (moduleId: string) => Promise<void>;
  serializeModule: (moduleId: string) => object[];
}

export class OverrideCollection<T extends any>
  extends Collection<T>
  implements OverrideCollectionInterface<T>
{
  replaced: VcsEvent<ReplacedEvent<T>>;
  shadowMap: Map<string, object[]>;
  override: (item: T) => T;
  parseItems: (items: object[], moduleId: string) => Promise<void>;
  getSerializedByKey: (key: string) => object;
  removeModule: (moduleId: string) => Promise<void>;
  serializeModule: (moduleId: string) => object[];
}

export class OverrideLayerCollection
  extends LayerCollection
  implements OverrideCollectionInterface<Layer>
{
  replaced: VcsEvent<ReplacedEvent<Layer>>;
  shadowMap: Map<string, object[]>;
  override: (item: Layer) => Layer;
  parseItems: (items: object[], moduleId: string) => Promise<void>;
  getSerializedByKey: (key: string) => object;
  removeModule: (moduleId: string) => Promise<void>;
  serializeModule: (moduleId: string) => object[];
}

export class OverrideMapCollection
  extends MapCollection
  implements OverrideCollectionInterface<VcsMap>
{
  replaced: VcsEvent<ReplacedEvent<VcsMap>>;
  shadowMap: Map<string, object[]>;
  override: (item: VcsMap) => VcsMap;
  parseItems: (items: object[], moduleId: string) => Promise<void>;
  getSerializedByKey: (key: string) => object;
  removeModule: (moduleId: string) => Promise<void>;
  serializeModule: (moduleId: string) => object[];
}
