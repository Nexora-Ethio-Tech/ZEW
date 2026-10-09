import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ApiError } from './http-error.js';
const subject = (scope: string, identity: string) =>
  createHash('sha256')
    .update(scope + ':' + identity)
    .digest('hex');
export class RateLimitError extends ApiError {
  constructor(public retryAfter: number) {
    super(429, `Too many attempts. Try again in ${retryAfter} seconds.`);
  }
}
export function checkLimit(db: DatabaseSync, scope: string, identity: string, maximum: number) {
  const row = db
    .prepare('SELECT count,expires_at FROM rate_limits WHERE subject=?')
    .get(subject(scope, identity));
  if (row && Number(row.expires_at) > Date.now() && Number(row.count) >= maximum)
    throw new RateLimitError(Math.ceil((Number(row.expires_at) - Date.now()) / 1000));
}
export function recordAttempt(db: DatabaseSync, scope: string, identity: string, windowMs: number) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(subject) DO UPDATE SET
    count=CASE WHEN expires_at <= ? THEN 1 ELSE MIN(count+1,1000000) END,
    expires_at=CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END`,
  ).run(subject(scope, identity), now + windowMs, now, now);
}
export function clearAttempts(db: DatabaseSync, scope: string, identity: string) {
  db.prepare('DELETE FROM rate_limits WHERE subject=?').run(subject(scope, identity));
}
