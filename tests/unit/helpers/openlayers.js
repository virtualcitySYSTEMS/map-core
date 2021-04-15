import Openlayers from '../../../src/vcs/vcm/maps/openlayers.js';

/**
 * @param {vcs.vcm.maps.Openlayers.Options=} mapOptions
 * @returns {Promise<vcs.vcm.maps.Openlayers>}
 */
export async function getOpenlayersMap(mapOptions) {
  const map = new Openlayers(mapOptions || {});
  await map.initialize();
  return map;
}

/**
 * @param {vcs.vcm.Framework} framework
 * @returns {Promise<vcs.vcm.maps.Openlayers>}
 */
export async function setOpenlayersMap(framework) {
  const map = await getOpenlayersMap({
    layerCollection: framework.layerCollection,
    target: framework.getMapContainer(),
  });
  framework.addMap(map);
  await framework.activateMap(map.name);
  return map;
}
