import Projection from '../../../src/util/projection.js';
import ObliqueMap from '../../../src/map/obliqueMap.js';
import Viewpoint from '../../../src/util/viewpoint.js';

import { getTerrainProvider } from './terrain/terrainData.js';
import ObliqueCollection from '../../../src/oblique/obliqueCollection.js';
import ObliqueDataSet from '../../../src/oblique/obliqueDataSet.js';
import importJSON from './importJSON.js';
import getFileNameFromUrl from './getFileNameFromUrl.js';

const fileName = getFileNameFromUrl(
  import.meta.url,
  '../../../data/oblique/imageData/imagev35.json',
);
const imageJson = await importJSON(fileName);

/**
 * Center point of first image
 * @type {import("ol/coordinate").Coordinate}
 */
export const mercatorCoordinates = [1488644.796500772, 6892246.018669462, 0];

/**
 * cached oblique Projection
 * @type {Projection}
 */
let obliqueProjection = null;

/**
 * @returns {Viewpoint}
 */
function getStartingViewpoint() {
  return new Viewpoint({
    name: '5b609a0d-28a1-4f4e-ba6c-29f2592fa889',
    distance: 264.6285087486175,
    cameraPosition: null,
    groundPosition: [13.41528061371218, 52.50232648590358],
    heading: 0,
    pitch: -90,
    roll: 0,
    animate: false,
  });
}

/**
 * returns an oblique Dataset
 * @param {Scope=} scope if provided the dataset is initialized with a terrainProvider
 * @returns {vcs-oblique/ObliqueDataSet}
 */
export async function getObliqueDataSet(scope) {
  if (!obliqueProjection) {
    obliqueProjection = new Projection({
      epsg: 'EPSG:25833',
      proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
    });
  }
  let terrainProvider;
  if (scope) {
    await getTerrainProvider(scope);
    terrainProvider = {
      url: 'http://localhost/terrain/',
    };
  }
  const obliqueDataSet = new ObliqueDataSet(
    'http://localhost/',
    obliqueProjection,
    terrainProvider,
  );
  await obliqueDataSet.initialize(imageJson);
  return obliqueDataSet;
}

/**
 * @param {Array<ObliqueDataSet>=} obliqueDataSets
 * @returns {ObliqueCollection}
 */
export async function getObliqueCollection(obliqueDataSets) {
  const dataSets = obliqueDataSets || [await getObliqueDataSet()];
  const obliqueCollection = new ObliqueCollection({
    name: 'obliqueCollection',
    dataSets,
  });
  return obliqueCollection;
}

/**
 * @param {ObliqueOptions} [mapOptions={}]
 * @param {Scope=} scope optional server, if provided the map will be initialized with a terrainProvider
 * @returns {Promise<ObliqueMap>}
 */
export async function getObliqueMap(mapOptions = {}, scope = undefined) {
  const obliqueDataSet = await getObliqueDataSet(scope);
  const obliqueCollection = await getObliqueCollection([obliqueDataSet]);
  const map = new ObliqueMap(mapOptions);
  await map.initialize();
  await map.setCollection(obliqueCollection);
  return map;
}

/**
 * @param {VcsApp} app
 * @param {Scope=} scope optional server, if provided the map will be initialized with a terrainProvider
 * @param {Viewpoint=} startingVP
 * @returns {Promise<ObliqueMap>}
 */
export async function setObliqueMap(app, scope, startingVP) {
  const map = await getObliqueMap(
    { layerCollection: app.layers, target: app.maps.target },
    scope,
  );
  app.maps.add(map);
  await app.maps.setActiveMap(map.name);
  await map.gotoViewpoint(startingVP || getStartingViewpoint());
  return map;
}
