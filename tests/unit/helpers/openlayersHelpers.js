import OpenlayersMap from '../../../src/map/openlayersMap.js';

/**
 * @param {OpenlayersOptions=} mapOptions
 * @returns {Promise<OpenlayersMap>}
 */
export async function getOpenlayersMap(mapOptions) {
  const map = new OpenlayersMap(mapOptions || {});
  await map.initialize();
  return map;
}

/**
 * @param {VcsApp} app
 * @returns {Promise<OpenlayersMap>}
 */
export async function setOpenlayersMap(app) {
  const map = await getOpenlayersMap({ layerCollection: app.layers, target: app.maps.target });
  app.maps.add(map);
  await app.maps.setActiveMap(map.name);
  return map;
}
