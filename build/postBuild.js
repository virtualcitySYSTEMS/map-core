import { dirname, join as joinPath, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { EOL } from 'node:os';

const dirName = dirname(fileURLToPath(import.meta.url));
const rootDir = joinPath(dirName, '..');
const distDir = joinPath(rootDir, 'dist');

const augmentations = [
  joinPath(rootDir, 'src', 'cesium', 'cesium.d.ts'),
  joinPath(rootDir, 'src', 'ol', 'ol.d.ts'),
];

async function moveAugmentation(filePath) {
  let content = await readFile(filePath, 'utf-8');
  content = content.replace(/from\s'\.\.\//g, "from './src/");
  const distName = joinPath(distDir, basename(filePath));
  await writeFile(distName, content);
}
async function moveAugmentations() {
  await Promise.all(augmentations.map(moveAugmentation));
  const importStatements = augmentations
    .map((a) => basename(a))
    .map((name) => `import './${name}';`);

  const indexFileName = joinPath(distDir, 'index.d.ts');
  await appendFile(indexFileName, importStatements.join(EOL));
}

moveAugmentations()
  .then(() => {
    console.log('Augmentations moved.');
  })
  .catch((e) => {
    console.error('Failed to move augmentations.');
    console.error(e);
  });
