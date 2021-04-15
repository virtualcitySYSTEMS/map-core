import fs from 'fs';
import CesiumTerrainProvider from 'cesium/Source/Core/CesiumTerrainProvider.js';
import layerJSON from '../../../data/terrain/layer.json';

const terrainFiles = {
  1388006485: './tests/data/terrain/13/8800/6485.terrain',
  1388006486: './tests/data/terrain/13/8800/6486.terrain',
  1388016485: './tests/data/terrain/13/8801/6485.terrain',
  1388016486: './tests/data/terrain/13/8801/6486.terrain',
};

const fileCache = new Map();

/**
 * serves http://localhost/terrain/
 * @param {Object} server
 */
export function setTerrainServer(server) {
  if (!fileCache.size) {
    Object.entries(terrainFiles).forEach(([key, value]) => {
      fileCache.set(key, fs.readFileSync(value).buffer);
    });
  }
  server.autoRespond = true;
  server.respondImmediately = true;
  server.respondWith(/terrain\/layer.json/, (res) => {
    res.respond(200, { 'Content-Type': 'application/json' }, JSON.stringify(layerJSON));
  });
  server.respondWith(/terrain\/(\d{2})\/(\d{4})\/(\d{4})\.terrain/, (res, x, y, z) => {
    res.respond(200, { 'Content-Type': 'application/vnd.quantized-mesh' }, fileCache.get(`${x}${y}${z}`));
  });
}

/**
 * @param {Object} server
 * @returns {cesium/CesiumTerrainProvider}
 */
export function getTerrainProvider(server) {
  setTerrainServer(server);
  return new CesiumTerrainProvider({
    url: 'http://localhost/terrain/',
  });
}
