import { is } from '@vcsuite/check';
import StyleItem from './styleItem.js';
import { defaultDeclarativeStyle } from './declarativeStyleItem.js';
import { styleClassRegistry } from '../classRegistry.js';
import VectorStyleItem from './vectorStyleItem.js';

/**
 * @param {(DeclarativeStyleItemOptions|VectorStyleItemOptions|StyleItem)=} styleOptions
 * @param {StyleItem=} defaultStyle
 * @returns {StyleItem}
 */
// eslint-disable-next-line import/prefer-default-export
export function getStyleOrDefaultStyle(styleOptions, defaultStyle) {
  if (is(styleOptions, [StyleItem, { type: String }])) {
    if (styleOptions instanceof StyleItem) {
      return styleOptions;
    } else {
      const styleItem = styleClassRegistry.createFromTypeOptions(styleOptions);
      if (styleItem) {
        if (styleItem instanceof VectorStyleItem && defaultStyle instanceof VectorStyleItem) {
          return defaultStyle.assign(styleItem);
        }
        return styleItem;
      }
    }
  }

  return defaultStyle || defaultDeclarativeStyle.clone();
}
