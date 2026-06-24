import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';
const command = isWindows ? 'powershell' : 'bash';
const scriptPath = path.join(scriptDir, isWindows ? 'deploy.ps1' : 'deploy.sh');
const args = isWindows
  ? ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...process.argv.slice(2)]
  : [scriptPath, ...process.argv.slice(2)];

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
