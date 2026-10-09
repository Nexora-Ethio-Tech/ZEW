// Operator-only provisioning. The management PAT is never used by the deployed API.
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const url = new URL(process.env.SUPABASE_URL),
  ref = url.hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Configure SUPABASE_ACCESS_TOKEN in the ignored backend environment.');
async function request(path, body) {
  const response = await fetch('https://api.supabase.com/v1/projects/' + ref + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error('Supabase provisioning request failed: HTTP ' + response.status);
  return response.json();
}
const pools = await request('/config/database/pooler');
const pool = pools.find((item) => item.pool_mode === 'transaction');
if (!pool) throw new Error('A transaction pooler is required.');
await request('/database/query', {
  query: readFileSync(new URL('../postgres/001_schema.sql', import.meta.url), 'utf8'),
});
const role = 'zew_runtime';
const roles = await request('/database/query', {
  query: "SELECT rolname FROM pg_roles WHERE rolname='zew_runtime'",
  read_only: true,
});
let connection = process.env.DATABASE_URL;
if (!roles.length) {
  const password = randomBytes(36).toString('hex');
  await request('/database/query', {
    query: `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; GRANT CONNECT ON DATABASE postgres TO ${role}; GRANT USAGE ON SCHEMA zew TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA zew TO ${role}; REVOKE UPDATE,DELETE ON zew.preview_settlements FROM ${role};`,
  });
  const uri = new URL('postgresql://' + pool.db_host + ':' + pool.db_port + '/' + pool.db_name);
  uri.username = role + '.' + ref;
  uri.password = password;
  connection = uri.href;
  const envPath = new URL('../.env', import.meta.url);
  const prior = readFileSync(envPath, 'utf8').replace(/^DATABASE_URL=.*\n?/gm, '');
  writeFileSync(envPath, prior.trimEnd() + '\nDATABASE_URL=' + connection + '\n', { mode: 0o600 });
  chmodSync(envPath, 0o600);
} else if (!connection)
  throw new Error(
    'The runtime role already exists. Supply its DATABASE_URL; credentials were not reset.',
  );
console.log(
  JSON.stringify({
    schema: 'zew',
    runtimeRole: role,
    credentials: 'saved only in backend/.env',
    poolerHost: pool.db_host,
  }),
);
