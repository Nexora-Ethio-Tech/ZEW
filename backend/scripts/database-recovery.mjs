import { DatabaseSync } from 'node:sqlite';
import {
  chmodSync,
  copyFileSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function inspectDatabase(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA integrity_check').all();
    if (check.length !== 1 || check[0].integrity_check !== 'ok')
      throw new Error('Database integrity check failed.');
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Database foreign key check failed.');
    const migrations = db
      .prepare('SELECT name FROM schema_migrations ORDER BY name')
      .all()
      .map((row) => row.name);
    return { integrity: 'ok', migrations };
  } finally {
    db.close();
  }
}
const checksum = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
function newDestination(source, destination) {
  if (
    resolve(source) === resolve(destination) ||
    existsSync(destination) ||
    existsSync(destination + '-wal') ||
    existsSync(destination + '-shm') ||
    existsSync(destination + '.sha256')
  )
    throw new Error(
      'Choose a new destination. Existing databases and backups are never overwritten.',
    );
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
}
export function backupDatabase(source, destination) {
  newDestination(source, destination);
  const previousMask = process.umask(0o077);
  try {
    const db = new DatabaseSync(source, { readOnly: true });
    try {
      db.prepare('VACUUM INTO ?').run(resolve(destination));
    } finally {
      db.close();
    }
    chmodSync(destination, 0o600);
    const inspection = inspectDatabase(destination);
    writeFileSync(destination + '.sha256', checksum(destination) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    return inspection;
  } finally {
    process.umask(previousMask);
  }
}
export function restoreDatabase(source, destination) {
  newDestination(source, destination);
  const expected = readFileSync(source + '.sha256', 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(expected) || checksum(source) !== expected)
    throw new Error('Backup checksum does not match. Restore aborted.');
  inspectDatabase(source);
  const previousMask = process.umask(0o077);
  try {
    copyFileSync(source, destination, constants.COPYFILE_EXCL);
    chmodSync(destination, 0o600);
    return inspectDatabase(destination);
  } finally {
    process.umask(previousMask);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, source, destination] = process.argv.slice(2);
  try {
    if (!source || (!destination && command !== 'verify'))
      throw new Error(
        'Usage: database-recovery.mjs backup|restore <source> <new-destination> | verify <database>',
      );
    const result =
      command === 'backup'
        ? backupDatabase(source, destination)
        : command === 'restore'
          ? restoreDatabase(source, destination)
          : command === 'verify'
            ? inspectDatabase(source)
            : null;
    if (!result) throw new Error('Unknown recovery command.');
    console.log(JSON.stringify({ command, ...result }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
