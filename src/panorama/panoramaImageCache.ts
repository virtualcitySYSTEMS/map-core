import LRUCache from 'ol/structs/LRUCache.js';
import type { PanoramaImage } from './panoramaImage.js';

/**
 * A specialized LRU cache
 */
export class PanoramaImageCache extends LRUCache<PanoramaImage> {
  deleteOldest(): void {
    const entry = this.pop();
    if (entry) {
      entry.destroy();
    }
  }
}
