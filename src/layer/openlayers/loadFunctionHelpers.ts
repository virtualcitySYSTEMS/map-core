import type { LoadFunction } from 'ol/Tile.js';
import type { ImageTile } from 'ol';
import TileState from 'ol/TileState.js';
import { getInitForUrl, requestObjectUrl } from '../../util/fetch.js';

// eslint-disable-next-line import/prefer-default-export
export function getTileLoadFunction(
  headers: Record<string, string>,
): LoadFunction {
  return function tileLoadFunction(imageTile, src): void {
    const image = (imageTile as ImageTile).getImage() as HTMLImageElement;
    const init = getInitForUrl(src, headers);
    requestObjectUrl(src, init)
      .then((blobUrl) => {
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
