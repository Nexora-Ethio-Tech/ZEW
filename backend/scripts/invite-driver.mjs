import { createClient } from '@supabase/supabase-js';
import { DatabaseSync } from 'node:sqlite';

const email = process.argv[2]?.trim().toLowerCase();
const redirectTo = process.argv[3] ?? 'http://localhost:3000/auth/callback';
if (!email || !process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error(
    'Usage: node --env-file=.env scripts/invite-driver.mjs <approved-email> [callback-url]',
  );
  process.exit(1);
}
let approved;
if (process.env.DATABASE_URL) {
  const { postgresPool } = await import('../dist/shared/postgres-pool.js');
  const pool = postgresPool(process.env.DATABASE_URL);
  try {
    approved = (
      await pool.query(
        'SELECT id FROM zew.driver_access WHERE lower(email) = lower($1) AND active = 1',
        [email],
      )
    ).rows[0];
  } finally {
    await pool.end();
  }
} else {
  const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/zew.sqlite', { readOnly: true });
  approved = db
    .prepare('SELECT id FROM driver_access WHERE email = ? COLLATE NOCASE AND active = 1')
    .get(email);
  db.close();
}
if (!approved) {
  console.error('Create an approved driver invitation before sending email.');
  process.exit(1);
}
const provider = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await provider.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
    emailRedirectTo: redirectTo,
  },
});
if (error) {
  console.error('Email link was not sent: ' + error.message);
  process.exit(1);
}
console.log(
  'Confirmation/sign-in email requested successfully. No password was created by this script.',
);
