import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * This circumvents a bug in webstorm, where scoped module .d.ts files arent
 * handled properly (there is no intellisense in webstorm otherwise)
 * @returns {Promise<void>}
 */
async function fixCesiumTypes() {
  const fileName = fileURLToPath(import.meta.url);
  if (
    path.resolve(path.dirname(fileName), '..') === process.cwd() &&
    fs.existsSync(path.join(process.cwd(), 'build', 'types'))
  ) {
    console.log('Moving Cesium.d.ts');
    await fs.promises.cp(
      path.join(process.cwd(), 'node_modules', '@vcmap', 'cesium', 'Source', 'Cesium.d.ts'),
      path.join(process.cwd(), 'build', 'types', 'Cesium_module.d.ts'),
      { force: true },
    );
  }
}

/**
 * There is a known, unfixed bug in tinyqueue. This is the fix (otherwise tinyqueue is not a constructor)
 * @returns {Promise<void>}
 */
async function fixTinyQueue() {
  const fileName = path.join(process.cwd(), 'node_modules', 'tinyqueue', 'package.json');
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    const jsonContent = JSON.parse(content);
    jsonContent.browser = 'tinyqueue.min.js';
    await fs.promises.writeFile(fileName, JSON.stringify(jsonContent, null, 2));
  }
}

async function run() {
  await Promise.all([fixTinyQueue(), fixCesiumTypes()]);
  console.log('fixed modules');
}

await run();
