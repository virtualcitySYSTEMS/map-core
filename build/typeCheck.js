/**
 * Script to perform type checking using the typescript compiler on the `src` directory.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Reads a directory, modifies all files so they can be read by typescript _without_ the typedefs.
 * Adds all subdirectories to the dir array for recursion.
 * @param {string} dir
 * @param {string} outBase
 * @returns {Promise<Array<string>>}
 */
async function rewriteDir(dir, outBase) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const promises = entries
    .map(async (e) => {
      const fullName = path.join(dir, e.name);
      if (e.isDirectory()) {
        return { dir: fullName };
      } else if (e.isFile()) {
        const content = await fs.promises.readFile(fullName);
        const outFile = path.join(outBase, fullName);
        await fs.promises.mkdir(path.dirname(outFile), { recursive: true });
        await fs.promises.writeFile(outFile, content.toString().replace(/\s\*\s(@typedef|@function)([\s\S]*?)\*\//g, (all) => {
          return all.replace(/(\/\*\*|\s\*)(.*)(\r?\n)/g, '$1$3');
        }));
        return { file: outFile };
      }
      return null;
    });
  const dirs = await Promise.all(promises);
  return dirs.filter(d => d);
}

/**
 * Rewrite all source files so TS can check them. This has to be done, to ensure _typedef_ s are evaluated
 * as we expect them to (with inheritance)
 * @param {string} [source='.src']
 * @param {string} [outBase='.types']
 * @returns {Promise<Array<string>>}
 */
async function rewriteForTS(source = 'src', outBase = '.types') {
  const dirs = [source];
  const writtenFiles = [];
  while (dirs.length > 0) {
    const dir = dirs.shift();
    // eslint-disable-next-line no-await-in-loop
    const newDirs = await rewriteDir(dir, outBase);
    newDirs.forEach((e) => {
      if (e.dir) {
        dirs.push(e.dir);
      } else if (e.file) {
        writtenFiles.push(e.file);
      }
    });
  }
  return writtenFiles;
}

/**
 * Remove the temporary .types directory
 * @param {string} [outBase='.types']
 * @returns {Promise<void>}
 */
async function cleanUp(outBase = '.types') {
  await fs.promises.rm(outBase, { recursive: true });
}

/**
 * Prints recursive typescript messages.
 * @param {string|ts.DiagnosticMessageChain} message
 * @param {number} [depth=1]
 */
function printMessage(message, depth = 1) {
  const stringMessage = typeof message === 'string' ?
    message :
    message.messageText;
  const tabs = new Array(depth).fill('\t').join('');
  console.log(`${tabs}${stringMessage}`);
  if (message.next && message.next.length > 0) {
    message.next.forEach((childMessage) => {
      printMessage(childMessage, depth + 1);
    });
  }
}

/**
 * Runs type checking by calling the typescript compiler on the cleaned source code
 * @returns {Promise<number>}
 */
async function typeCheck() {
  const program = ts.createProgram(['.types/index.js'], {
    allowJs: true,
    checkJs: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.es2022.d.ts'],
    target: 'ESNext',
    module: 'es2022',
    noEmit: true,
    baseUrl: './',
    downlevelIteration: true,
    paths: {
      '@vcmap/core': ['.types/index.js'],
    },
    types: [
      './node_modules/@vcmap-cesium/engine/index',
      './build/types/cesium',
      './build/types/ol',
      './build/types/vcs',
    ],
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
  });

  let counter = 0;
  ts.getPreEmitDiagnostics(program).forEach((diagnostic) => {
    const message = diagnostic.messageText;
    const { file } = diagnostic;
    if (file) {
      const filename = file.fileName.replace(/.*\/\.types\//, '');
      const lineAndChar = file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );

      const line = lineAndChar.line + 1;
      const character = lineAndChar.character + 1;

      console.log(`${filename}:${line}:${character}`);
    }
    printMessage(message);
    console.log('');
    counter += 1;
  });

  if (counter > 0) {
    console.log(`found ${counter} errors`);
    return 1;
  }
  return 0;
}

/**
 * The main function of this script
 * @returns {Promise<void>}
 */
async function main() {
  await rewriteForTS();
  await fs.promises.copyFile('index.js', '.types/index.js');
  const errorCode = await typeCheck();
  await cleanUp();
  process.exit(errorCode);
}

await main();
