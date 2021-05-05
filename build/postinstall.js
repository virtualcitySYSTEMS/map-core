import path from 'path';
import fs from 'fs';

async function fixOpenlayers() {
  const fileName = path.join(process.cwd(), 'node_modules', 'ol', 'package.json');
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    const jsonContent = JSON.parse(content);
    jsonContent.type = 'module';
    await fs.promises.writeFile(fileName, JSON.stringify(jsonContent, null, 2));
  }
}

async function fixTinyQueue() {
  const fileName = path.join(process.cwd(), 'node_modules', 'tinyqueue', 'package.json');
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    const jsonContent = JSON.parse(content);
    jsonContent.browser = 'tinyqueue.min.js';
    await fs.promises.writeFile(fileName, JSON.stringify(jsonContent, null, 2));
  }
}

async function fixCesium() {
  const fileName = path.join(process.cwd(), 'node_modules', 'cesium', 'package.json');
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    const jsonContent = JSON.parse(content);
    jsonContent.exports['./Source/'] = './Source/';
    await fs.promises.writeFile(fileName, JSON.stringify(jsonContent, null, 2));
  }
}

async function run() {
  await Promise.all([fixOpenlayers(), fixTinyQueue(), fixCesium()]);
  console.log('fixed modules');
}

run();
