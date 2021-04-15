/* eslint-disable camelcase */
import t2199_1342 from '../../data/oblique/tiledImageData/12/2199/1342.json';
import t2199_1343 from '../../data/oblique/tiledImageData/12/2199/1343.json';
import t2199_1344 from '../../data/oblique/tiledImageData/12/2199/1344.json';
import t2200_1342 from '../../data/oblique/tiledImageData/12/2200/1342.json';
import t2200_1343 from '../../data/oblique/tiledImageData/12/2200/1343.json';
import t2200_1344 from '../../data/oblique/tiledImageData/12/2200/1344.json';
import t2201_1342 from '../../data/oblique/tiledImageData/12/2201/1342.json';
import t2201_1343 from '../../data/oblique/tiledImageData/12/2201/1343.json';
import t2201_1344 from '../../data/oblique/tiledImageData/12/2201/1344.json';
import imageJsonTiled from '../../data/oblique/tiledImageData/image.json';

const tiledImageData = {
  12: {
    2199: {
      1342: t2199_1342,
      1343: t2199_1343,
      1344: t2199_1344,
    },
    2200: {
      1342: t2200_1342,
      1343: t2200_1343,
      1344: t2200_1344,
    },
    2201: {
      1342: t2201_1342,
      1343: t2201_1343,
      1344: t2201_1344,
    },
  },
};

/**
 * Center point of first image in 12/2200/1342
 * @type {import("ol/coordinate").Coordinate}
 */
export const tiledMercatorCoordinate = [1487752.4290728183, 6888473.584735272, 0];
/**
 * Center point of first image in 12/2199/1342
 * @type {import("ol/coordinate").Coordinate}
 */
export const tiledMercatorCoordinate2 = [1477722.079812214, 6897970.75026968, 0];
/**
 * Center point of first image
 * @type {import("ol/coordinate").Coordinate}
 */
export const imagev35MercatorCoordinate = [1488644.796500772, 6892246.018669462, 0];

/**
 * serves http://localhost/tiledOblique/image.json
 * @param {Object} server
 */
export default function setTiledObliqueImageServer(server) {
  server.autoRespond = true;
  server.respondImmediately = true;
  server.respondWith(/tiledOblique\/12\/(\d{4})\/(\d{4})\.json/, (res, x, y) => {
    res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(tiledImageData['12'][x][y]));
  });
  server.respondWith(/tiledOblique\/image.json/, (res) => {
    res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(imageJsonTiled));
  });
}
