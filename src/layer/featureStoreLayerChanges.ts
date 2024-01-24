import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import { EventsKey } from 'ol/events.js';
import type { VectorSourceEvent } from 'ol/source/Vector.js';
import type {
  Feature as GeojsonFeature,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import { check } from '@vcsuite/check';
import { featureStoreStateSymbol } from './featureStoreLayerState.js';
import { parseGeoJSON, writeGeoJSONFeature } from './geojsonHelpers.js';
import VcsObject from '../vcsObject.js';

import type FeatureStoreLayer from './featureStoreLayer.js';
import VcsEvent from '../vcsEvent.js';

export type FeatureStoreTrackResults = {
  add: Feature[];
  edit: Feature[];
  remove: Feature[];
};

export type FeatureStoreChangesListeners = {
  addfeature: EventsKey | EventsKey[] | null;
  changefeature: EventsKey | EventsKey[] | null;
  removefeature: EventsKey | EventsKey[] | null;
};

export type FeatureStoreGeojsonGeometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon;

export type FeatureStoreGeojsonFeature<
  G extends FeatureStoreGeojsonGeometry = FeatureStoreGeojsonGeometry,
  P extends Record<string, unknown> = Record<string, unknown>,
> = Omit<GeojsonFeature<G, P>, 'id'> & {
  _id?: string;
  id?: string;
};

type CommitAction = {
  action: 'add' | 'edit' | 'remove';
  feature: FeatureStoreGeojsonFeature | { _id: string };
  original: Feature;
  success(opt?: string): void;
};

export function createCommitActions(
  added: Set<Feature>,
  edited: Set<Feature>,
  removed: Set<Feature>,
): CommitAction[] {
  const actions: CommitAction[] = [];
  added.forEach((f) => {
    const feature = writeGeoJSONFeature(f, {
      writeStyle: true,
    }) as FeatureStoreGeojsonFeature;
    actions.push({
      action: 'add',
      feature,
      original: f,
      success(data) {
        f.setId(data);
        f[featureStoreStateSymbol] = 'dynamic';
      },
    });
  });

  edited.forEach((f) => {
    const feature = writeGeoJSONFeature(f, {
      writeStyle: true,
    }) as FeatureStoreGeojsonFeature;
    feature._id = f.getId() as string;
    actions.push({
      action: 'edit',
      original: f,
      feature,
      success() {
        if (f[featureStoreStateSymbol] === 'static') {
          f[featureStoreStateSymbol] = 'edited';
        }
      },
    });
  });

  removed.forEach((f) => {
    actions.push({
      original: f,
      action: 'remove',
      feature: { _id: f.getId() as string },
      success() {},
    });
  });

  return actions;
}

/**
 * do not construct directly, use the layers .changeTracker instead
 */
class FeatureStoreLayerChanges extends VcsObject {
  static get className(): string {
    return 'FeatureStoreLayerChanges';
  }

  private _layer: FeatureStoreLayer | undefined;

  private _changesListeners: FeatureStoreChangesListeners = {
    addfeature: null,
    changefeature: null,
    removefeature: null,
  };

  private _addedFeatures: Set<Feature> = new Set();

  private _editedFeatures: Set<Feature> = new Set();

  private _removedFeatures: Set<Feature> = new Set();

  private _convertedFeatures: Set<Feature> = new Set();

  changed = new VcsEvent<void>();

  constructor(layer: FeatureStoreLayer) {
    super({});
    this._layer = layer;
  }

  get layer(): FeatureStoreLayer {
    if (!this._layer) {
      throw new Error('Trying to access destroyed feature store changes');
    }
    return this._layer;
  }

  /**
   * Whether changes are being tracked or not
   */
  get active(): boolean {
    return Object.values(this._changesListeners).some((c) => c !== null);
  }

  /**
   * starts tracking changes on the layer
   * starts tracking changes on the feature store layer
   */
  track(): void {
    if (this._changesListeners.addfeature === null) {
      this._changesListeners.addfeature = this.layer.source.on(
        'addfeature',
        this._featureAdded.bind(this),
      );
    }

    if (this._changesListeners.changefeature === null) {
      this._changesListeners.changefeature = this.layer.source.on(
        'changefeature',
        this._featureChanged.bind(this),
      );
    }

    if (this._changesListeners.removefeature === null) {
      this._changesListeners.removefeature = this.layer.source.on(
        'removefeature',
        this._featureRemoved.bind(this),
      );
    }
  }

  getChanges(): FeatureStoreTrackResults {
    return {
      add: [...this._addedFeatures],
      edit: [...this._editedFeatures],
      remove: [...this._removedFeatures],
    };
  }

  hasChanges(): boolean {
    return (
      this._addedFeatures.size !== 0 ||
      this._editedFeatures.size !== 0 ||
      this._removedFeatures.size !== 0
    );
  }

  /**
   * commits the changes to the provided url. url should contain accessTokens and point to a featureStore layers bulk operation endpoint
   */
  async commitChanges(
    postCallback: (
      body: Pick<CommitAction, 'action' | 'feature'>[],
    ) => Promise<{
      failedActions: { index: number; error: string }[];
      insertedIds: { _id: string }[];
    }>,
  ): Promise<void> {
    const actions: (CommitAction | null)[] = createCommitActions(
      this._addedFeatures,
      this._editedFeatures,
      this._removedFeatures,
    );
    if (actions.length > 0) {
      const data = await postCallback(
        actions.map((a) => ({ action: a!.action, feature: a!.feature })),
      );

      const failures = data.failedActions.map(({ index, error }) => {
        const action = actions[index] as CommitAction;
        this.getLogger().log(`failed action ${action.action}: ${error}`);
        actions[index] = null;
        return this._resetFeature(action.original);
      });

      actions.forEach((action) => {
        if (action) {
          if (action.action === 'add') {
            action.success(data.insertedIds.shift()?._id); // XXX should this be shift or should we find the index?
          } else {
            action.success();
          }
        }
      });
      await Promise.all(failures);
    } else {
      try {
        await Promise.all(
          [...this._convertedFeatures].map(async (f) => {
            await this._resetFeature(f);
          }),
        );
      } catch (err) {
        this.getLogger().error(String(err));
      }
      this._resetValues();
    }
  }

  /**
   * resets all changes since the last commit or the beginning of tracking
   */
  async reset(): Promise<void> {
    const promises: Promise<void>[] = [];
    this._addedFeatures.forEach((f) => {
      promises.push(this._resetFeature(f));
    });
    this._editedFeatures.forEach((f) => {
      promises.push(this._resetFeature(f));
    });
    this._removedFeatures.forEach((f) => {
      promises.push(this._resetFeature(f));
    });
    this._convertedFeatures.forEach((f) => {
      promises.push(this._resetFeature(f));
    });
    return Promise.all(promises)
      .then(() => {
        this._resetValues();
      })
      .catch((err) => {
        this.getLogger().error(String(err));
        this._resetValues();
      });
  }

  private _resetFeature(feature: Feature): Promise<void> {
    const featureId = feature.getId() as string | number;
    const idArray = [featureId];
    if (!feature[featureStoreStateSymbol]) {
      this.layer.removeFeaturesById(idArray);
      return Promise.resolve();
    }

    if (feature[featureStoreStateSymbol] === 'static') {
      this.layer.resetStaticFeature(featureId);
      return Promise.resolve();
    }

    return this.layer
      .injectedFetchDynamicFeatureFunc(featureId)
      .then((data) => {
        const { features } = parseGeoJSON(data);
        this.layer.removeFeaturesById(idArray);
        this.layer.addFeatures(features);
      })
      .catch((err) => {
        this.getLogger().error(
          'failed to reset feature, giving up',
          String(err),
        );
      });
  }

  private _resetValues(): void {
    this._addedFeatures.clear();
    this._editedFeatures.clear();
    this._removedFeatures.clear();
    this._convertedFeatures.clear();
  }

  /**
   * stops tracking changes on the feature store layer
   */
  unTrack(): void {
    unByKey(
      Object.values(this._changesListeners).filter((e) => e) as EventsKey[],
    );
    this._changesListeners.addfeature = null;
    this._changesListeners.changefeature = null;
    this._changesListeners.removefeature = null;
    this._resetValues();
  }

  /**
   * pauses the tracking of the given event, but does not reset features
   * @param  event - one of: addfeature, changefeature or removefeature
   */
  pauseTracking(event: keyof FeatureStoreChangesListeners): void {
    if (this._changesListeners[event]) {
      unByKey(this._changesListeners[event] as EventsKey);
      this._changesListeners[event] = null;
    }
  }

  private _featureAdded(event: VectorSourceEvent | { feature: Feature }): void {
    const { feature } = event;
    if (feature) {
      if (!feature[featureStoreStateSymbol]) {
        this._addedFeatures.add(feature);
        this.changed.raiseEvent();
      } else if (feature[featureStoreStateSymbol] === 'static') {
        this._convertedFeatures.add(feature);
        this.changed.raiseEvent();
      }
    }
  }

  private _featureChanged(
    event: VectorSourceEvent | { feature: Feature },
  ): void {
    const { feature } = event;
    if (feature) {
      if (feature[featureStoreStateSymbol]) {
        this._convertedFeatures.delete(feature);
        this._editedFeatures.add(feature);
        this.changed.raiseEvent();
      }
    }
  }

  private _featureRemoved(
    event: VectorSourceEvent | { feature: Feature },
  ): void {
    const { feature } = event;
    if (feature) {
      if (feature[featureStoreStateSymbol]) {
        this._removedFeatures.add(feature);
        this._editedFeatures.delete(feature);
        this._convertedFeatures.delete(feature);
        this.changed.raiseEvent();
      } else {
        this._addedFeatures.delete(feature);
      }
    }
  }

  /**
   * tracks the change of removing a static feature
   */
  removeFeature(feature: Feature): void {
    check(feature, Feature);

    this._featureRemoved({ feature });
  }

  /**
   * adds an addition to the tracker. prefer use of .track
   */
  addFeature(feature: Feature): void {
    check(feature, Feature);

    this._featureAdded({ feature });
  }

  /**
   * adds an edit to the tracker. prefer use of .track
   */
  editFeature(feature: Feature): void {
    check(feature, Feature);

    this._featureChanged({ feature });
  }

  destroy(): void {
    this.unTrack();
    this._layer = undefined;
    this.changed.destroy();
    super.destroy();
  }
}

export default FeatureStoreLayerChanges;
