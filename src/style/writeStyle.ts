import type { VectorStyleItemOptions } from './vectorStyleItem.js';
import VectorStyleItem from './vectorStyleItem.js';
import DeclarativeStyleItem from './declarativeStyleItem.js';
import { type VcsMeta, vcsMetaVersion } from '../layer/vectorProperties.js';
import type StyleItem from './styleItem.js';

export function embedIconsInStyle(
  obj: VectorStyleItemOptions,
  embeddedIcons?: string[],
): VectorStyleItemOptions {
  if (obj.image && obj.image.src && /^data:/.test(obj.image.src)) {
    if (embeddedIcons) {
      let index = embeddedIcons.indexOf(obj.image.src);
      if (index === -1) {
        embeddedIcons.push(obj.image.src);
        index = embeddedIcons.length - 1;
      }
      obj.image.src = `:${index}`;
    } else {
      obj.image = {
        // XXX is this the correct fallback?
        radius: 5,
      };
    }
  }
  return obj;
}

function writeStyle(
  style: StyleItem,
  vcsMeta: VcsMeta = { version: vcsMetaVersion },
): VcsMeta {
  // XXX this entire function is not what is to be expected. feature store expects styles as refs to be possible
  if (style instanceof VectorStyleItem) {
    vcsMeta.style = embedIconsInStyle(style.toJSON(), vcsMeta.embeddedIcons);
  } else if (style instanceof DeclarativeStyleItem) {
    vcsMeta.style = style.toJSON();
  }
  return vcsMeta;
}

export default writeStyle;
