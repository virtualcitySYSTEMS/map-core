import { is, oneOf } from '@vcsuite/check';
import StyleItem, { StyleItemOptions } from './styleItem.js';
import {
  DeclarativeStyleItemOptions,
  defaultDeclarativeStyle,
} from './declarativeStyleItem.js';
import { styleClassRegistry } from '../classRegistry.js';
import VectorStyleItem, { VectorStyleItemOptions } from './vectorStyleItem.js';

// eslint-disable-next-line import/prefer-default-export
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
