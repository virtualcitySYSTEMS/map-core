import { getLogger as getLoggerByName } from '@vcsuite/logger';
import StyleItem, { StyleType } from './styleItem.js';
import DeclarativeStyleItem, { defaultDeclarativeStyle } from './declarativeStyleItem.js';
import VectorStyleItem from './vectorStyleItem.js';
import { styleCollection } from '../../globalCollections.js';

/**
 * @returns {vcs-logger/Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.util.style.styleFactory');
}

/**
 * @param {(vcs.vcm.util.style.Reference|vcs.vcm.util.style.DeclarativeStyleItem.Options|vcs.vcm.util.style.VectorStyleItem.Options|vcs.vcm.util.style.ClusterStyleItem.Options|vcs.vcm.util.style.StyleItem|string)=} styleOptions
 * @param {(vcs.vcm.util.style.VectorStyleItem|vcs.vcm.util.style.ClusterStyleItem|vcs.vcm.util.style.DeclarativeStyleItem)=} defaultStyle
 * @returns {vcs.vcm.util.style.StyleItem}
 */
// eslint-disable-next-line import/prefer-default-export
export function getStyleOrDefaultStyle(styleOptions, defaultStyle) {
  if (typeof styleOptions === 'string') {
    const styleItem = styleCollection.getByKey(styleOptions);
    if (styleItem) {
      return styleItem;
    }
    getLogger().warning(`could not find style with name ${styleOptions}`);
  } else if (styleOptions && (styleOptions instanceof StyleItem)) {
    return styleOptions;
  } else if (styleOptions) { // DeclarativeStyleItem.Options || VectorStyleItem.Options || ClusterStyleItem.Options
    if (
      /** @type {vcs.vcm.util.style.DeclarativeStyleItem.Options} */ (styleOptions).type === StyleType.DECLARATIVE ||
      /** @type {vcs.vcm.util.style.DeclarativeStyleItem.Options} */ (styleOptions).declarativeStyle) {
      return new DeclarativeStyleItem(/** @type {vcs.vcm.util.style.DeclarativeStyleItem.Options} */ (styleOptions));
    } else if (/** @type {vcs.vcm.util.style.Reference} */ (styleOptions).type === StyleType.REFERENCE) {
      const { name } = /** @type {vcs.vcm.util.style.Reference} */ (styleOptions);
      const styleItem = styleCollection.getByKey(name);
      if (styleItem) {
        return styleItem;
      }
      getLogger().warning(`could not find style with name ${name}`);
    } else {
      // @ts-ignore
      const vectorStyle = new VectorStyleItem(/** @type {vcs.vcm.util.style.VectorStyleItem.Options} */ styleOptions);
      return defaultStyle instanceof VectorStyleItem ? defaultStyle.assign(vectorStyle) : vectorStyle;
    }
  }
  return defaultStyle || defaultDeclarativeStyle.clone();
}
