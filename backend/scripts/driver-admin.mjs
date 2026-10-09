// Local operator command. Never exposed as an HTTP endpoint or imported by the frontend.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
if (process.env.DATABASE_URL) {
  await import('./postgres-driver-admin.mjs');
} else {
  const [command, email, name, vehicle, seatsText] = process.argv.slice(2);
  const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/zew.sqlite');
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  try {
    db.exec('BEGIN IMMEDIATE');
    if (
      command === 'invite' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '') &&
      name &&
      vehicle &&
      Number.isInteger(Number(seatsText)) &&
      Number(seatsText) >= 1 &&
      Number(seatsText) <= 8
    ) {
      db.prepare('INSERT INTO driver_access(id,email,name,vehicle,seats) VALUES (?,?,?,?,?)').run(
        randomUUID(),
        email.toLowerCase(),
        name,
        vehicle,
        Number(seatsText),
      );
      console.log('Driver invitation created. Email confirmation is still required.');
    } else if (command === 'route' && email) {
      const driver =
        email === 'off'
          ? null
          : db
              .prepare('SELECT id FROM driver_access WHERE email = ? COLLATE NOCASE AND active = 1')
              .get(email);
      if (email !== 'off' && !driver)
        throw new Error('No active driver invitation matches that email.');
      db.prepare('UPDATE dispatch_settings SET test_driver_id = ? WHERE id = 1').run(
        driver?.id ?? null,
      );
      console.log(
        email === 'off'
          ? 'Test routing disabled. New requests fail closed until a driver is configured.'
          : 'New test requests will go to the selected driver. Existing assignments are preserved.',
      );
    } else if (command === 'revoke' && email) {
      const result = db
        .prepare('UPDATE driver_access SET active = 0 WHERE email = ? COLLATE NOCASE')
        .run(email);
      if (!result.changes) throw new Error('Driver invitation not found.');
      console.log('Driver access revoked, including existing sessions.');
    } else
      throw new Error(
        'Usage: driver-admin.mjs invite <email> <name> <vehicle> <seats> | route <email|off> | revoke <email>',
      );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
