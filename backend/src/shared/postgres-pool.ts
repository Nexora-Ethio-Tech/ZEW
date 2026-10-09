import pg from 'pg';
import { readFileSync } from 'node:fs';
export function postgresPool(connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must use PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (process.env.VERCEL && local) throw new Error('Vercel requires a hosted PostgreSQL database.');
  // Do not let a connection-string sslmode silently disable certificate verification.
  url.searchParams.delete('sslmode');
  return new pg.Pool({
    connectionString: url.href,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(url.hostname.endsWith('.supabase.com') || url.hostname.endsWith('.supabase.co')
            ? { ca: readFileSync(new URL('../../certs/supabase-ca.crt', import.meta.url), 'utf8') }
            : {}),
        },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: true,
    statement_timeout: 15000,
    query_timeout: 20000,
  });
}
