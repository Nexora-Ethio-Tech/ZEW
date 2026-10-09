// Operator-only command; uses the same database as the hosted API.
import { randomUUID } from 'node:crypto';
import { postgresPool } from '../dist/shared/postgres-pool.js';
const [command, email, name, vehicle, seatsText] = process.argv.slice(2);
const pool = postgresPool(process.env.DATABASE_URL);
const db = await pool.connect();
try {
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended('zew:workspace-writes',0))");
  if (
    command === 'invite' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '') &&
    name &&
    vehicle &&
    Number.isInteger(Number(seatsText)) &&
    Number(seatsText) >= 1 &&
    Number(seatsText) <= 8
  ) {
    await db.query(
      'INSERT INTO zew.driver_access(id,email,name,vehicle,seats) VALUES ($1,$2,$3,$4,$5)',
      [randomUUID(), email.toLowerCase(), name, vehicle, Number(seatsText)],
    );
    console.log('Driver invitation created. Email confirmation is still required.');
  } else if (command === 'route' && email) {
    const driver =
      email === 'off'
        ? null
        : (
            await db.query(
              'SELECT id FROM zew.driver_access WHERE lower(email)=lower($1) AND active=1',
              [email],
            )
          ).rows[0];
    if (email !== 'off' && !driver)
      throw new Error('No active driver invitation matches that email.');
    await db.query('UPDATE zew.dispatch_settings SET test_driver_id=$1 WHERE id=1', [
      driver?.id ?? null,
    ]);
    console.log(
      email === 'off'
        ? 'Test routing disabled. New requests fail closed.'
        : 'New test requests will go to the selected driver. Existing assignments are preserved.',
    );
  } else if (command === 'revoke' && email) {
    const result = await db.query(
      'UPDATE zew.driver_access SET active=0 WHERE lower(email)=lower($1)',
      [email],
    );
    if (!result.rowCount) throw new Error('Driver invitation not found.');
    console.log('Driver access revoked, including existing sessions.');
  } else
    throw new Error(
      'Usage: driver-admin.mjs invite <email> <name> <vehicle> <seats> | route <email|off> | revoke <email>',
    );
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
