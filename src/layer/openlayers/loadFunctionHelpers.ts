import type { LoadFunction } from 'ol/Tile.js';
import type { ImageTile } from 'ol';
import { TrustedServers } from '@vcmap-cesium/engine';
import TileState from 'ol/TileState.js';

// eslint-disable-next-line import/prefer-default-export
export function getTileLoadFunction(
  headers: Record<string, string>,
): LoadFunction {
  return function tileLoadFunction(imageTile, src): void {
    const image = (imageTile as ImageTile).getImage() as HTMLImageElement;
    const init: RequestInit = {
      headers,
    };
    if (TrustedServers.contains(src)) {
      init.credentials = 'include';
    }
    fetch(src, init)
      .then((response) => {
        if (!response.ok) {
          throw new Error('not 2xx response', { cause: response });
        }
        return response.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);

        image.src = blobUrl;
        image.onload = (): void => {
          URL.revokeObjectURL(blobUrl);
        };
      })
      .catch(() => {
        imageTile.setState(TileState.ERROR);
      });
  };
}
