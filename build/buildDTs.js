/**
 * Builds a index.d.ts file using the @vcsuite/jsdoc-tsd jsdoc plugin.
 */
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import { EOL } from 'os';

const promiseExec = promisify(exec);
console.log('building type definitions');
await promiseExec('node node_modules/jsdoc/jsdoc.js -c build/tsd/conf.json');
console.log('rephrasing...');
const data = await fs.promises.readFile('./index.d.ts');
const overrideCollectionData = await fs.promises.readFile('./build/types/overrideCollection.d.ts');
const editorData = await fs.promises.readFile('./build/types/editor.d.ts');

// we need to replace certain _assumptions_ to make this readable by typescript
const exportData = data.toString()
  .replace(/^declare/gm, 'export')
  .replace(/import\("@vcmap\/core"\)./g, '')
  .replace(/module:@vcmap\/core~/g, '')
  .replace(/module:([@\w\d/-]+)~([\w\d]+)/g, 'import("$1").$2')
  .replace(/<{(.*)} T>/g, (all, toExtend) => `<T extends ${toExtend.replace('*', 'any')}>`)
  .replace(/export\sinterface\s.*extends.*{\n}/g, '')
  .replace(/\.</g, '<')
  .replace(/export\svar\s\[0][^;]+;\n/g, '')
  .replace(/^\s+_[^;]+;/gm, '')
  .replace(/LRUCache</g, 'import("ol/structs/LRUCache").default<')
  .replace(/extends import\("ol"\).Feature<import\("ol\/geom\/Geometry"\).default>/, 'extends olFeature<Geometry>');

const overrideCollection = overrideCollectionData.toString()
  .replace(/import.*;/, '');

const editor = editorData.toString()
  .replace(/import.*;/, '');

await fs.promises.writeFile(
  './index.d.ts',
  `import olFeature from 'ol/Feature';
import Geometry from 'ol/geom/Geometry';
import Style from 'ol/style/Style';

${exportData}
${overrideCollection}
${editor}
`,
);

console.log('verifying definitions');

/**
 * Trys to compile a small typescript file using the generated index.d.ts to validate, that the types are readable by
 * typescript
 * @returns {Promise<Array<string>>}
 */
function verifyTsd() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      /^win/i.test(process.platform) ? 'npx.cmd' : 'npx',
      ['tsc', '-p', 'tests/typescript/tsconfig.json'],
    );
    const errors = [];

    child.stdout.on('data', (chunk) => {
      chunk.toString()
        .split(EOL)
        .forEach((stringChunk) => {
          if (stringChunk.startsWith('index.d.ts')) {
            errors.push(stringChunk);
          }
        });
    });

    child.on('error', reject);
    child.on('close', () => {
      resolve(errors);
    });
  });
}

const typeFailures = await verifyTsd();
if (typeFailures.length > 0) {
  typeFailures.forEach((e) => { console.log(e); });
  process.exit(1);
} else {
  console.log('all good');
  process.exit(0);
}
