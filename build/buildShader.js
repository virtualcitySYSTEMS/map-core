import { readFile, writeFile, watch } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'path';
import fs from 'fs';

export async function* getFilesInDirectory(filePath) {
  const entries = await fs.promises.readdir(filePath, { withFileTypes: true });

  for (const file of entries) {
    if (file.isDirectory()) {
      yield* getFilesInDirectory(path.join(filePath, file.name));
    } else if (file.isFile()) {
      yield path.join(filePath, file.name);
    }
  }
}

async function buildShader(file) {
  const fileName = file.replace(/\.glsl$/, '.shader.ts');
  const content = await readFile(file, 'utf-8');
  await writeFile(
    fileName,
    `// This file is auto-generated. Do not edit it directly.
export default \`
${content}
\``,
  );
}

async function buildShaders() {
  for await (const file of getFilesInDirectory('src')) {
    if (file.endsWith('.glsl')) {
      await buildShader(file);
    }
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  buildShaders()
    .then(async () => {
      if (process.argv.includes('--watch')) {
        console.log('Watching for changes...');
        try {
          const watcher = watch('src', { recursive: true });
          const debounceMap = new Map();
          const debounceTime = 100; // debounce time in ms

          for await (const event of watcher) {
            const file = `src/${event.filename}`;
            if (file.endsWith('.glsl')) {
              if (debounceMap.has(file)) {
                clearTimeout(debounceMap.get(file));
              }

              debounceMap.set(
                file,
                setTimeout(async () => {
                  console.log(`File ${file} has been changed`);
                  await buildShader(file);
                  debounceMap.delete(file);
                }, debounceTime),
              );
            }
          }
        } catch (error) {
          console.error(`Watcher error: ${error}`);
        }
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
