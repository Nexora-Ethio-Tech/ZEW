import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const children = [
  spawn(
    process.execPath,
    ['--env-file-if-exists=.env', '--import', 'tsx', '--watch', 'src/server.ts'],
    { cwd: fileURLToPath(new URL('backend/', root)), stdio: 'inherit' },
  ),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '0.0.0.0'], {
    cwd: fileURLToPath(new URL('frontend/', root)),
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
