import LRUCache from 'ol/structs/LRUCache.js';
import type { PanoramaTile } from './panoramaTile.js';

/**
 * A specialized LRU cache
 */
export class PanoramaTileCache extends LRUCache<PanoramaTile> {
  deleteOldest(): void {
    const entry = this.pop();
    if (entry) {
      entry.destroy();
    }
  }

  expireCache(usedTiles: Record<string, boolean> = {}): void {
    while (this.canExpireCache()) {
      const tile = this.peekLast();
      if (usedTiles[tile.tileCoordinate.key]) {
        break;
      } else {
        this.pop().destroy();
      }
    }
  }
}

/**
 * convenience function to cache a tile and cleanup all the non-visible tiles
 * @param tile
 * @param cache
 * @param currentlyVisibleTileKeys
 */
export function addTileToCache(
  tile: PanoramaTile,
  cache: PanoramaTileCache,
  currentlyVisibleTileKeys: Record<string, boolean>,
): void {
  cache.set(tile.tileCoordinate.key, tile);
  cache.expireCache(currentlyVisibleTileKeys);
}
