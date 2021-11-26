import VectorStyleItem from './vectorStyleItem.js';
import DeclarativeStyleItem from './declarativeStyleItem.js';
import { referenceableStyleSymbol } from './styleItem.js';

/**
 * @param {VectorStyleItemOptions} obj
 * @param {Array<string>=} embeddedIcons
 * @returns {VectorStyleItemOptions}
 */
export function embedIconsInStyle(obj, embeddedIcons) {
  if (
    obj.image &&
    obj.image.src &&
    /^data:/.test(obj.image.src)
  ) {
    if (embeddedIcons) {
      let index = embeddedIcons.indexOf(obj.image.src);
      if (index === -1) {
        embeddedIcons.push(obj.image.src);
        index = embeddedIcons.length - 1;
      }
      obj.image.src = `:${index}`;
    } else {
      obj.image = { // XXX is this the correct fallback?
        radius: 5,
      };
    }
  }
  return obj;
}

/**
 * @param {import("@vcmap/core").StyleItem} style
 * @param {VcsMeta=} vcsMeta
 * @returns {VcsMeta}
 */
function writeStyle(style, vcsMeta = {}) {
  if (style[referenceableStyleSymbol]) { // XXX this should be configurable. In some cases, writting out the actual style would be desirable
    vcsMeta.style = style.getReference();
  } else if (style instanceof VectorStyleItem) {
    vcsMeta.style = embedIconsInStyle(style.getOptions(), vcsMeta.embeddedIcons);
  } else if (style instanceof DeclarativeStyleItem) {
    vcsMeta.style = style.getOptions();
  }
  return vcsMeta;
}

export default writeStyle;
