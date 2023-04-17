/* eslint-disable camelcase */
import nock from 'nock';
import importJSON from './importJSON.js';

const t2199_1342 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2199/1342.json',
);
const t2199_1343 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2199/1343.json',
);
const t2199_1344 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2199/1344.json',
);
const t2200_1342 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2200/1342.json',
);
const t2200_1343 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2200/1343.json',
);
const t2200_1344 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2200/1344.json',
);
const t2201_1342 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2201/1342.json',
);
const t2201_1343 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2201/1343.json',
);
const t2201_1344 = await importJSON(
  './tests/data/oblique/tiledImageData/12/2201/1344.json',
);
const imageJsonTiled = await importJSON(
  './tests/data/oblique/tiledImageData/image.json',
);

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
export const tiledMercatorCoordinate = [
  1487752.4290728183, 6888473.584735272, 0,
];
/**
 * Center point of first image in 12/2199/1342
 * @type {import("ol/coordinate").Coordinate}
 */
export const tiledMercatorCoordinate2 = [
  1477722.079812214, 6897970.75026968, 0,
];
/**
 * Center point of first image
 * @type {import("ol/coordinate").Coordinate}
 */
export const imagev35MercatorCoordinate = [
  1488644.796500772, 6892246.018669462, 0,
];

/**
 * serves http://localhost/tiledOblique/image.json
 * @param {import("nock").Scope=} optScope
 * @returns {import("nock").Scope} scope
 */
export default function getTiledObliqueImageServer(optScope) {
  return (optScope || nock('http://localhost'))
    .persist()
    .get('/tiledOblique/image.json')
    .reply(
      200,
      JSON.stringify(imageJsonTiled),
      // zlib.gzipSync(Buffer.from(JSON.stringify(imageJsonTiled))),
      { 'Content-Type': 'application/json' },
    )
    .get(/tiledOblique\/12\/(\d{4})\/(\d{4})\.json/)
    .reply((uri) => {
      const [x, y] = uri.match(/(\d{4})/g);
      return [
        200,
        JSON.stringify(tiledImageData['12'][x][y]),
        { 'Content-Type': 'application/json' },
      ];
    });
}
