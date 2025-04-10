import { is, oneOf } from '@vcsuite/check';
import type { StyleItemOptions } from './styleItem.js';
import StyleItem from './styleItem.js';
import type { DeclarativeStyleItemOptions } from './declarativeStyleItem.js';
import { defaultDeclarativeStyle } from './declarativeStyleItem.js';
import { styleClassRegistry } from '../classRegistry.js';
import type { VectorStyleItemOptions } from './vectorStyleItem.js';
import VectorStyleItem from './vectorStyleItem.js';

export function getStyleOrDefaultStyle(
  styleOptions?:
    | DeclarativeStyleItemOptions
    | VectorStyleItemOptions
    | StyleItem,
  defaultStyle?: StyleItem,
): StyleItem {
  if (is(styleOptions, oneOf(StyleItem, { type: String }))) {
    if (styleOptions instanceof StyleItem) {
      return styleOptions;
    } else {
      const styleItem = styleClassRegistry.createFromTypeOptions(
        styleOptions as StyleItemOptions,
      );
      if (styleItem) {
        if (
          styleItem instanceof VectorStyleItem &&
          defaultStyle instanceof VectorStyleItem
        ) {
          return styleItem.assign(defaultStyle.clone().assign(styleItem));
        }
        return styleItem;
      }
    }
  }

  return defaultStyle || defaultDeclarativeStyle.clone();
}
