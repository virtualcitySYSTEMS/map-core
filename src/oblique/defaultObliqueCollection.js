import ObliqueCollection from './obliqueCollection.js';
import ObliqueImage from './obliqueImage.js';
import ObliqueImageMeta from './obliqueImageMeta.js';
import { ObliqueViewDirection } from './obliqueViewDirection.js';
import { mercatorProjection } from '../util/projection.js';

const defaultMeta = new ObliqueImageMeta({
  name: 'defaultObliqueMeta',
  size: [512, 512],
  tileSize: [512, 512],
  tileResolution: [1],
  projection: mercatorProjection,
  format: 'png',
  url: '',
});

/**
 * @type {symbol}
 * @private
 */
export const isDefaultImageSymbol = Symbol('isDefaultImage');

/**
 * This is a special oblique collection wich is shown, if no other oblique collection is set on an ObliqueMap map.
 * It will render a single image which indicates that no images can be loaded.
 * @class
 * @extends {ObliqueCollection}
 */
class DefaultObliqueCollection extends ObliqueCollection {
  constructor() {
    super({});
  }

  /**
   * @param {import("ol/coordinate").Coordinate} mercatorCoordinate
   * @param {ObliqueViewDirection} viewDirection
   * @returns {ObliqueImage}
   */
  // eslint-disable-next-line no-unused-vars
  getImageForCoordinate(mercatorCoordinate, viewDirection) {
    const groundCoordinates = [
      [mercatorCoordinate[0] - 100, mercatorCoordinate[1] - 100, 0],
      [mercatorCoordinate[0] + 100, mercatorCoordinate[1] - 100, 0],
      [mercatorCoordinate[0] + 100, mercatorCoordinate[1] + 100, 0],
      [mercatorCoordinate[0] - 100, mercatorCoordinate[1] + 100, 0],
    ];

    const image = new ObliqueImage({
      meta: defaultMeta,
      viewDirection: ObliqueViewDirection.NORTH,
      viewDirectionAngle: 0,
      name: this.name,
      groundCoordinates,
      centerPointOnGround: mercatorCoordinate,
    });

    image[isDefaultImageSymbol] = true;
    return image;
  }
}

export default DefaultObliqueCollection;
