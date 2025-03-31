import { check } from '@vcsuite/check';
import type VectorClusterGroup from './vectorClusterGroup.js';
import Collection from '../util/collection.js';
import GlobalHider from '../layer/globalHider.js';

export default class VectorClusterGroupCollection extends Collection<VectorClusterGroup> {
  /**
   * The global hider for this collection.
   */
  private _globalHider: GlobalHider;

  constructor(globalHider: GlobalHider) {
    super();
    this._globalHider = globalHider;

    this.added.addEventListener((g) => {
      g.setGlobalHider(this._globalHider);
    });
    this.removed.addEventListener((g) => {
      g.setGlobalHider();
    });
  }

  /**
   * The current global hider of these layers
   */
  get globalHider(): GlobalHider {
    return this._globalHider;
  }

  /**
   * The current global hider of these layers
   * @param  globalHider
   */
  set globalHider(globalHider: GlobalHider) {
    check(globalHider, GlobalHider);

    this._globalHider = globalHider;
    this._array.forEach((vectorClusterGroup) => {
      vectorClusterGroup.setGlobalHider(this._globalHider);
    });
  }
}
