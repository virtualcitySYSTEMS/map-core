import { check } from '@vcsuite/check';
import type {
  HighlightableFeature,
  FeatureVisibilityEvent,
} from './featureVisibility.js';
import {
  globalHidden,
  hideFeature,
  cacheOriginalStyle,
  showFeature,
  FeatureVisibilityAction,
} from './featureVisibility.js';
import VcsEvent from '../vcsEvent.js';

/**
 * GlobalHider globally hides features existing within a layer of a {@link LayerCollection}.
 * Features can be defined as hidden by {@link VcsModuleConfig} or {@link LayerOptions}.
 * Hiding will be performed, when a {@link VcsModule} is loaded, a {@link Layer} is activated or GlobalHider API is called.
 * A feature can be hidden multiple times by different actors, e.g. modules, layers, which is handled by this class.
 * A feature will be shown again, when a {@link VcsModule} is removed, a {@link Layer} is deactivated or GlobalHider API is called.
 */
class GlobalHider {
  hiddenObjects: Record<string, number> = {};

  private _hiddenObjectFeatures: Record<string, Set<HighlightableFeature>> = {};

  lastUpdated: number = Date.now();

  /**
   * An event raised when the hidden ids change. Is called with
   * {@link FeatureVisibilityEvent} as its only argument
   */
  changed = new VcsEvent<FeatureVisibilityEvent>();

  /**
   * Add a tick to the hide count, hidding the features if they are not already hidden
   */
  hideObjects(uuids: string[]): void {
    check(uuids, [String]);

    const updatedIds: string[] = [];
    uuids.forEach((uuid) => {
      if (!this.hiddenObjects[uuid]) {
        updatedIds.push(uuid);
        this.hiddenObjects[uuid] = 0;
      }
      this.hiddenObjects[uuid] += 1;
    });

    if (updatedIds.length > 0) {
      this.lastUpdated = Date.now();
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.HIDE,
        ids: updatedIds,
      });
    }
  }

  /**
   * Subtract from the hide count for an Array of ids. If the array reaches 0, features with said UUID will be shown
   */
  showObjects(uuids: string[]): void {
    check(uuids, [String]);

    const updatedIds: string[] = [];
    uuids.forEach((uuid) => {
      if (this.hiddenObjects[uuid]) {
        this.hiddenObjects[uuid] -= 1;
        if (this.hiddenObjects[uuid] === 0) {
          if (this._hiddenObjectFeatures[uuid]) {
            this._hiddenObjectFeatures[uuid].forEach((f) => {
              showFeature(f, globalHidden);
            });
            this._hiddenObjectFeatures[uuid].clear();
          }
          delete this.hiddenObjects[uuid];
          updatedIds.push(uuid);
        }
      }
    });

    if (updatedIds.length > 0) {
      this.changed.raiseEvent({
        action: FeatureVisibilityAction.SHOW,
        ids: updatedIds,
      });
    }
  }

  addFeature(uuid: number | string, feature: HighlightableFeature): void {
    if (!this._hiddenObjectFeatures[uuid]) {
      this._hiddenObjectFeatures[uuid] = new Set();
    }
    cacheOriginalStyle(feature);
    this._hiddenObjectFeatures[uuid].add(feature);
    feature[globalHidden] = true;
    hideFeature(feature);
  }

  hasFeature(uuid: string | number, feature: HighlightableFeature): boolean {
    return this._hiddenObjectFeatures[uuid]
      ? this._hiddenObjectFeatures[uuid].has(feature)
      : false;
  }

  destroy(): void {
    this.hiddenObjects = {};
    Object.values(this._hiddenObjectFeatures).forEach((set) => {
      set.clear();
    });
    this._hiddenObjectFeatures = {};
    this.changed.destroy();
  }
}

export default GlobalHider;
