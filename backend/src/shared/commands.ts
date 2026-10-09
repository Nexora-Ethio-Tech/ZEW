import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ApiError } from './http-error.js';

const context = new AsyncLocalStorage<{ key: string; fingerprint: string }>();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'null';
}
export function withCommand<T>(
  key: unknown,
  method: string,
  path: string,
  body: unknown,
  run: () => T,
): T {
  if (key === undefined) return run();
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(key))
    throw new ApiError(400, 'Use a valid Idempotency-Key.');
  const fingerprint = createHash('sha256')
    .update(canonical([method, path, body]))
    .digest('hex');
  return context.run({ key, fingerprint }, run);
}
// Caller holds BEGIN IMMEDIATE. The mutation and its receipt commit or roll back together.
export function executeCommand<T>(db: DatabaseSync, workspaceId: string, run: () => T): T {
  const command = context.getStore();
  if (!command) return run();
  const prior = db
    .prepare('SELECT fingerprint,result FROM mutation_receipts WHERE workspace_id=? AND key=?')
    .get(workspaceId, command.key);
  if (prior) {
    if (prior.fingerprint !== command.fingerprint)
      throw new ApiError(409, 'This retry key was already used for a different request.');
    return JSON.parse(prior.result as string) as T;
  }
  const result = run();
  db.prepare('INSERT INTO mutation_receipts VALUES (?,?,?,?,?)').run(
    workspaceId,
    command.key,
    command.fingerprint,
    JSON.stringify(result),
    Date.now(),
  );
  return result;
}
