import fs from 'fs';
import { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import importJSON from '../importJSON.js';
import getFileNameFromUrl from '../getFileNameFromUrl.js';

const fileName = getFileNameFromUrl(
  import.meta.url,
  '../../../../data/terrain/layer.json',
);
export const layerJson = await importJSON(fileName);
export const terrainFiles = {
  1388006485: './tests/data/terrain/13/8800/6485.terrain',
  1388006486: './tests/data/terrain/13/8800/6486.terrain',
  1388016485: './tests/data/terrain/13/8801/6485.terrain',
  1388016486: './tests/data/terrain/13/8801/6486.terrain',
};

/**
 * serves http://myTerrainProvider/terrain/
 * @param {import("nock").Scope} scope
 */
export function setTerrainServer(scope) {
  scope
    .get('/terrain/layer.json')
    .reply(200, layerJson, { 'Content-Type': 'application/json' })
    .get(/terrain\/(\d{2})\/(\d{4})\/(\d{4})\.terrain.*/)
    .reply((uri) => {
      const [x, y] = uri.match(/(\d{4})/g);
      const terrainFile = terrainFiles[`13${x}${y}`];
      const res = terrainFile
        ? fs.createReadStream(terrainFiles[`13${x}${y}`])
        : Buffer.from('');
      return [200, res, { 'Content-Type': 'application/vnd.quantized-mesh' }];
    })
    .persist();
}

/**
 * @param {Scope} scope
 * @returns {Promise<import("@vcmap-cesium/engine").CesiumTerrainProvider>}
 */
export async function getTerrainProvider(scope) {
  setTerrainServer(scope);
  return CesiumTerrainProvider.fromUrl('http://localhost/terrain/', {});
}
