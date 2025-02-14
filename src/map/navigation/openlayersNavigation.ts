import OpenlayersMap from '../openlayersMap.js';
import NavigationImpl, { NavigationImplOptions } from './navigationImpl.js';
import { Movement } from './navigation.js';
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
