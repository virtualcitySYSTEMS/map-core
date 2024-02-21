import FeatureVisibility, { HighlightStyleType } from './featureVisibility.js';
import type FeatureStoreLayerChanges from './featureStoreLayerChanges.js';

export default class FeatureStoreFeatureVisibility extends FeatureVisibility {
  private _changeTracker: FeatureStoreLayerChanges;

  constructor(changeTracker: FeatureStoreLayerChanges) {
    super();
    this._changeTracker = changeTracker;
  }

  highlight(toHighlight: Record<string, HighlightStyleType>): void {
    const isTracking = this._changeTracker.active;
    if (isTracking) {
      this._changeTracker.pauseTracking('changefeature');
    }
    super.highlight(toHighlight);
    if (isTracking) {
      this._changeTracker.track();
    }
  }

  unHighlight(toUnHighlight: (string | number)[]): void {
    const isTracking = this._changeTracker.active;
    if (isTracking) {
      this._changeTracker.pauseTracking('changefeature');
    }
    super.unHighlight(toUnHighlight);
    if (isTracking) {
      this._changeTracker.track();
    }
  }

  hideObjects(toHide: (string | number)[]): void {
    const isTracking = this._changeTracker.active;
    if (isTracking) {
      this._changeTracker.pauseTracking('changefeature');
    }
    super.hideObjects(toHide);
    if (isTracking) {
      this._changeTracker.track();
    }
  }

  showObjects(unHide: (string | number)[]): void {
    const isTracking = this._changeTracker.active;
    if (isTracking) {
      this._changeTracker.pauseTracking('changefeature');
    }
    super.showObjects(unHide);
    if (isTracking) {
      this._changeTracker.track();
    }
  }
}
