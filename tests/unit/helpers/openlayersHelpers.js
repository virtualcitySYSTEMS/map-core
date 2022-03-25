import Openlayers from '../../../src/vcs/vcm/maps/openlayers.js';

/**
 * @param {OpenlayersOptions=} mapOptions
 * @returns {Promise<Openlayers>}
 */
export async function getOpenlayersMap(mapOptions) {
  const map = new Openlayers(mapOptions || {});
  await map.initialize();
  return map;
}

/**
 * @param {VcsApp} app
 * @returns {Promise<Openlayers>}
 */
export async function setOpenlayersMap(app) {
  const map = await getOpenlayersMap({ layerCollection: app.layers, target: app.maps.target });
  app.maps.add(map);
  await app.maps.setActiveMap(map.name);
  return map;
}
