import path from 'path';
import fs from 'fs';

async function* getFilesInDirectory(filePath) {
  const entries = await fs.promises.readdir(filePath, { withFileTypes: true });
  // eslint-disable-next-line no-restricted-syntax
  for (const file of entries) {
    if (file.isDirectory()) {
      yield* getFilesInDirectory(path.join(filePath, file.name));
    } else if (file.isFile()) {
      yield path.join(filePath, file.name);
    }
  }
}

function replaceRelativeImport(content) {
  return content.replaceAll(
    /(import[^'"]*['"](?:\.|\.\.)\/(?:\.\.\/)*[^'".]*)(['"])/g,
    '$1.js$2',
  );
}

async function fixNode16RelativeImport(dir) {
  if (fs.existsSync(dir)) {
    for await (const f of getFilesInDirectory(dir)) {
      if (path.extname(f) === '.ts') {
        let content = await fs.promises.readFile(f, 'utf-8');
        content = replaceRelativeImport(content);
        await fs.promises.writeFile(f, content);
      }
    }
  }
}

async function fixOpenlayersPaletteTextureUint8Array() {
  const fileName = path.join(
    process.cwd(),
    'node_modules',
    'ol',
    'webgl',
    'PaletteTexture.d.ts',
  );
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName, 'utf-8');
    const fixedContent = content.replace(
      /Uint8Array<ArrayBufferLike>/g,
      'Uint8Array',
    );
    await fs.promises.writeFile(fileName, fixedContent);
  }
}

/**
 * Fixes relative imports in openlayers TS definitions
 * @returns {Promise<void>}
 */
async function fixOpenlayers() {
  await Promise.all([
    fixNode16RelativeImport(path.join(process.cwd(), 'node_modules', 'ol')),
    fixNode16RelativeImport(
      path.join(process.cwd(), 'node_modules', 'geotiff', 'dist-module'),
    ),
    fixOpenlayersPaletteTextureUint8Array(),
  ]);
}

/**
 * There is a known, unfixed bug in tinyqueue. This is the fix (otherwise tinyqueue is not a constructor)
 * @returns {Promise<void>}
 */
async function fixTinyQueue() {
  const fileName = path.join(
    process.cwd(),
    'node_modules',
    'tinyqueue',
    'package.json',
  );
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    const jsonContent = JSON.parse(content);
    jsonContent.browser = 'tinyqueue.min.js';
    await fs.promises.writeFile(fileName, JSON.stringify(jsonContent, null, 2));
  }
}

async function fixResizeObserverPolyfill() {
  const fileName = path.join(
    process.cwd(),
    'node_modules',
    'resize-observer-polyfill',
    'src',
    'index.d.ts',
  );
  if (fs.existsSync(fileName)) {
    let content = await fs.promises.readFile(fileName, 'utf-8');
    content = content.replace(/interface\sDOMRectReadOnly\s?\{[^}]*}\s/gm, '');
    await fs.promises.writeFile(fileName, content);
  }
}

async function run() {
  await Promise.all([
    fixTinyQueue(),
    fixOpenlayers(),
    fixResizeObserverPolyfill(),
  ]);
  console.log('fixed modules');
}

await run();
