import type { LoadFunction } from 'ol/Tile.js';
import type { LoadFunction as ImageLoadFunction } from 'ol/Image.js';
import type { ImageTile } from 'ol';
import TileState from 'ol/TileState.js';
import { getLogger } from '@vcsuite/logger';
import { getInitForUrl, requestObjectUrl } from '../../util/fetch.js';

export function getImageLoadFunction(
  headers: Record<string, string>,
): ImageLoadFunction {
  return function imageLoadFunction(image, src): void {
    const img = image.getImage() as HTMLImageElement;
    const init = getInitForUrl(src, headers);
    requestObjectUrl(src, init)
      .then((blobUrl) => {
        img.src = blobUrl;
        const revokeObjectUrl = (): void => {
          URL.revokeObjectURL(blobUrl);
        };
        img.onload = revokeObjectUrl;
        img.onerror = revokeObjectUrl;
      })
      .catch(() => {
        img.dispatchEvent(new Event('error'));
        getLogger('ImageLoadFunction').error(`Could not load image: ${src}`);
      });
  };
}

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
