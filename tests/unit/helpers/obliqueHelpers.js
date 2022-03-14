import Projection from '../../../src/vcs/vcm/util/projection.js';
import Oblique from '../../../src/vcs/vcm/maps/oblique.js';
import ViewPoint from '../../../src/vcs/vcm/util/viewpoint.js';

import { getTerrainProvider } from './terrain/terrainData.js';
import ObliqueCollection from '../../../src/vcs/vcm/oblique/ObliqueCollection.js';
import ObliqueDataSet from '../../../src/vcs/vcm/oblique/ObliqueDataSet.js';
import importJSON from './importJSON.js';

const imageJson = await importJSON('./tests/data/oblique/imageData/imagev35.json');

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
 * @returns {ViewPoint}
 */
function getStartingViewpoint() {
  return new ViewPoint({
    name: '5b609a0d-28a1-4f4e-ba6c-29f2592fa889',
    distance: 264.6285087486175,
    cameraPosition: null,
    groundPosition: [
      13.41528061371218,
      52.50232648590358,
    ],
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
export function getObliqueDataSet(scope) {
  if (!obliqueProjection) {
    obliqueProjection = new Projection({
      epsg: 'EPSG:25833',
      proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
    });
  }
  let terrainProvider;
  if (scope) {
    getTerrainProvider(scope);
    terrainProvider = {
      url: 'http://localhost/terrain/',
    };
  }
  const obliqueDataSet = new ObliqueDataSet('http://localhost/', obliqueProjection, terrainProvider);
  obliqueDataSet.initialize(imageJson);
  return obliqueDataSet;
}


/**
 * @param {Array<ObliqueDataSet>=} obliqueDataSets
 * @returns {ObliqueCollection}
 */
export function getObliqueCollection(obliqueDataSets) {
  const dataSets = obliqueDataSets || [getObliqueDataSet()];
  const obliqueCollection = new ObliqueCollection({
    name: 'obliqueCollection',
    dataSets,
  });
  return obliqueCollection;
}

/**
 * @param {ObliqueOptions} mapOptions
 * @param {Scope=} scope optional server, if provided the map will be initialized with a terrainProvider
 * @returns {Promise<Oblique>}
 */
export async function getObliqueMap(mapOptions = {}, scope) {
  const obliqueDataSet = getObliqueDataSet(scope);
  const obliqueCollection = getObliqueCollection([obliqueDataSet]);
  const map = new Oblique(mapOptions);
  await map.initialize();
  await map.setCollection(obliqueCollection);
  return map;
}

/**
 * @param {vcs.vcm.Framework} framework
 * @param {Scope=} scope optional server, if provided the map will be initialized with a terrainProvider
 * @param {ViewPoint=} startingVP
 * @returns {Promise<Oblique>}
 */
export async function setObliqueMap(framework, scope, startingVP) {
  const map = await getObliqueMap({
    layerCollection: framework.layerCollection,
    target: framework.mapcontainer,
  }, scope);
  framework.addMap(map);
  await framework.activateMap(map.name);
  await map.gotoViewPoint(startingVP || getStartingViewpoint());
  return map;
}
