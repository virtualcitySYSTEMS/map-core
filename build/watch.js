import { spawn } from 'node:child_process';

function spawnProcess(command, args, name) {
  console.log(`Starting ${name} watcher...`);

  const childProcess = spawn(command, args, {
    stdio: 'inherit',
  });

  childProcess.on('error', (error) => {
    console.error(error);
  });

  childProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[${name}] Process exited with code ${code}`);
    }
  });

  return childProcess;
}

const tscProcess = spawnProcess(
  'node',
  ['node_modules/typescript/bin/tsc', '--watch'],
  'tsc',
);

const shaderProcess = spawnProcess(
  'node',
  ['build/buildShader.js', '--watch'],
  'shader',
);

// Handle process termination
function cleanup() {
  console.log('\nShutting down watchers...');

  if (tscProcess) {
    tscProcess.kill();
  }

  if (shaderProcess) {
    shaderProcess.kill();
  }
}

// Handle termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
