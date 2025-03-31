import type OpenlayersMap from '../openlayersMap.js';
import type { NavigationImplOptions } from './navigationImpl.js';
import NavigationImpl from './navigationImpl.js';
import type { Movement } from './navigation.js';
import { moveView } from './viewHelper.js';

export type OpenlayersNavigationOptions = NavigationImplOptions;

class OpenlayersNavigation extends NavigationImpl<OpenlayersMap> {
  static get className(): string {
    return 'OpenlayersNavigation';
  }

  static getDefaultOptions(): OpenlayersNavigationOptions {
    return { ...NavigationImpl.getDefaultOptions() };
  }

  update(movement: Movement): void {
    moveView(this._map, movement.input, this.baseTranSpeed);
  }
}

export default OpenlayersNavigation;
