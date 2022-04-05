import { getLogger as getLoggerByName } from '@vcsuite/logger';
import StyleItem, { StyleType } from './styleItem.js';
import DeclarativeStyleItem, { defaultDeclarativeStyle } from './declarativeStyleItem.js';
import VectorStyleItem from './vectorStyleItem.js';
import { styleCollection } from '../globalCollections.js';

/**
 * @returns {import("@vcsuite/logger").Logger}
 */
function getLogger() {
  return getLoggerByName('styleFactory');
}

/**
 * @param {(Reference|DeclarativeStyleItemOptions|VectorStyleItemOptions|StyleItem|string)=} styleOptions
 * @param {StyleItem=} defaultStyle
 * @returns {StyleItem}
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
  } else if (styleOptions) { // DeclarativeStyleItemOptions || VectorStyleItemOptions || ClusterStyleItemOptions
    if (
      /** @type {DeclarativeStyleItemOptions} */ (styleOptions).type === StyleType.DECLARATIVE ||
      /** @type {DeclarativeStyleItemOptions} */ (styleOptions).declarativeStyle) {
      return new DeclarativeStyleItem(/** @type {DeclarativeStyleItemOptions} */ (styleOptions));
    } else if (/** @type {Reference} */ (styleOptions).type === StyleType.REFERENCE) {
      const { name } = /** @type {Reference} */ (styleOptions);
      const styleItem = styleCollection.getByKey(name);
      if (styleItem) {
        return styleItem;
      }
      getLogger().warning(`could not find style with name ${name}`);
    } else {
      // @ts-ignore
      const vectorStyle = new VectorStyleItem(/** @type {VectorStyleItemOptions} */ styleOptions);
      return defaultStyle instanceof VectorStyleItem ? defaultStyle.assign(vectorStyle) : vectorStyle;
    }
  }
  return defaultStyle || defaultDeclarativeStyle.clone();
}
