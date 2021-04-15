import path from 'path';
import fs from 'fs';

async function makeModule(packageJson) {
  const content = await fs.promises.readFile(packageJson);
  const jsonContent = JSON.parse(content);
  jsonContent.type = 'module';
  await fs.promises.writeFile(packageJson, JSON.stringify(jsonContent, null, 2));
}

function fixOpenlayers() {
  return makeModule(path.join(process.cwd(), 'node_modules', 'ol', 'package.json'));
}

async function fixTinyQueue() {
  const packageJson = path.join(process.cwd(), 'node_modules', 'tinyqueue', 'package.json');
  const content = await fs.promises.readFile(packageJson);
  const jsonContent = JSON.parse(content);
  jsonContent.browser = 'tinyqueue.min.js';
  await fs.promises.writeFile(packageJson, JSON.stringify(jsonContent, null, 2));
}

async function fixCesium() {
  const olPackageJson = path.join(process.cwd(), 'node_modules', 'cesium', 'package.json');
  const content = await fs.promises.readFile(olPackageJson);
  const jsonContent = JSON.parse(content);
  jsonContent.exports['./Source/'] = './Source/';
  await fs.promises.writeFile(olPackageJson, JSON.stringify(jsonContent, null, 2));
}

async function run() {
  await Promise.all([fixOpenlayers(), fixTinyQueue(), fixCesium()]);
  console.log('fixed modules');
}

run();
