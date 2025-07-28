import LRUCache from 'ol/structs/LRUCache.js';
import type { PanoramaImage } from './panoramaImage.js';

/**
 * A specialized LRU cache
 */
export class PanoramaImageCache extends LRUCache<Promise<PanoramaImage>> {
  deleteOldest(): void {
    const entry = this.pop();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (entry) {
      entry
        .then((image) => {
          image.destroy();
        })
        .catch(() => {});
    }
  }
}
