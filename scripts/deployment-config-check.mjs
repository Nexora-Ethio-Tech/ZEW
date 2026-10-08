import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../frontend/', import.meta.url));
const script = `
  import assert from 'node:assert/strict';
  const { default: config } = await import('./next.config.ts');
  const [rewrite] = await config.rewrites();
  assert.equal(rewrite.source, '/api/v1/:path*');
  assert.equal(rewrite.destination, process.env.EXPECTED_DESTINATION);
`;
for (const { name, url, vercel, valid, error } of [
  { name: 'local default', valid: true },
  { name: 'public HTTPS backend', url: 'https://api.example.test', vercel: '1', valid: true },
  { name: 'missing Vercel backend', vercel: '1', valid: false, error: 'Set API_URL' },
  {
    name: 'localhost Vercel backend',
    url: 'http://localhost:4000',
    vercel: '1',
    valid: false,
    error: 'public HTTPS',
  },
  {
    name: 'backend path',
    url: 'https://api.example.test/api/v1',
    valid: false,
    error: 'origin without credentials',
  },
  {
    name: 'backend credentials',
    url: 'https://example:example@api.example.test',
    valid: false,
    error: 'origin without credentials',
  },
]) {
  const settings = { ...process.env };
  delete settings.API_URL;
  delete settings.VERCEL;
  if (url) settings.API_URL = url;
  if (vercel) settings.VERCEL = vercel;
  settings.EXPECTED_DESTINATION = `${url ?? 'http://127.0.0.1:4000'}/api/v1/:path*`;
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    { cwd, env: settings, encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(result.status === 0, valid, name);
  if (!valid) assert.ok(result.stderr.includes(error), `${name} has an actionable error`);
}
console.log('PASS: six local/Vercel backend configuration cases.');
