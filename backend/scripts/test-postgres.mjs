import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const schema = 'zew_test_' + randomBytes(8).toString('hex');
if (!process.env.DATABASE_URL || !process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error('Configure the operator environment first.');
async function sql(query) {
  const response = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('Postgres fixture setup failed: HTTP ' + response.status);
  return response.json();
}
try {
  await sql(
    readFileSync(new URL('../postgres/001_schema.sql', import.meta.url), 'utf8').replace(
      /\bzew\b/g,
      schema,
    ) +
      `\nGRANT USAGE ON SCHEMA ${schema} TO zew_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${schema} TO zew_runtime;`,
  );
  const seedTables = ['group_catalog', 'planned_catalog', 'driver_access', 'dispatch_settings'];
  for (const table of seedTables)
    await sql(`INSERT INTO ${schema}.${table} SELECT * FROM zew.${table}`);
  // Isolate the test driver binding from the actual confirmed account.
  await sql(`UPDATE ${schema}.driver_access SET user_id=NULL;`);
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/postgres.test.ts'], {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      ZEW_POSTGRES_TEST_SCHEMA: schema,
      ZEW_POSTGRES_TEST_URL: process.env.DATABASE_URL,
    },
  });
  process.exitCode = await new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
} finally {
  if (!/^zew_test_[a-f0-9]{16}$/.test(schema)) throw new Error('Refusing unsafe schema cleanup.');
  await sql(`DROP SCHEMA ${schema} CASCADE`);
  console.log('Isolated Postgres fixture removed; application data was untouched.');
}
