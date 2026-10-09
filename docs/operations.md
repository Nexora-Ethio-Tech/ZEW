# Operations and recovery

Zew uses Supabase PostgreSQL for the Vercel deployment and supports SQLite for local development. Operator access to database credentials is the authorization boundary; these are not public endpoints. Run commands from `backend/` with Node 24+ after `npm run build`. `DATABASE_URL` selects PostgreSQL; otherwise tools use `DATABASE_PATH`. Tools do not print credentials, passenger details, bearer tokens or boarding codes.

## Hosted PostgreSQL recovery

Use the Supabase project’s backup/restore facilities or a separately managed PostgreSQL backup, with restricted access and encrypted off-host retention. Verify the project’s actual backup coverage and retention before relying on it; this repository does not configure a backup schedule or claim a completed hosted restore drill. The restricted runtime role cannot restore schemas. Recovery needs an operator role and a compatible application release.

Before schema changes, capture a recoverable database snapshot. Test restoration into an isolated project, apply the matching schema/application release, verify counts and private account access, shared reservations, retry receipts and simulated settlements, then record the recovery time. Coordinate traffic before switching `DATABASE_URL`; restoring an older snapshot loses later writes. Supabase Auth is a separate identity dependency and must remain consistent with provider IDs in application accounts.

`postgres/001_schema.sql` is operator-managed. `scripts/provision-postgres.mjs` provisions the private schema and restricted runtime role. `scripts/migrate-to-postgres.ts` accepts a consistent SQLite snapshot only for an empty destination; never use it to overwrite a live hosted database.

The following backup/restore file commands apply only to the optional SQLite adapter.

## Backup before an upgrade

```bash
node scripts/database-recovery.mjs backup data/zew.sqlite data/backups/before-upgrade.sqlite
node scripts/database-recovery.mjs verify data/backups/before-upgrade.sqlite
```

Choose a fresh destination for each backup. `VACUUM INTO` creates a consistent snapshot while the source API is running, including committed WAL data. The tool performs integrity and foreign-key checks, writes a SHA-256 sidecar, and restricts snapshot permissions to 0600. It refuses to overwrite any existing destination. Keep the `.sha256` file with the snapshot. A checksum detects corruption; it is not encryption or protection from malicious replacement.

A backup on the same disk is insufficient for disk loss. Configure an encrypted off-host destination and retention schedule in your hosting environment. This repository does not install a scheduler or choose a cloud account. The database contains private account/ride records and hashed sessions; restrict access to backups accordingly.

## Restore drill and recovery

1. Select a verified backup and a **new** destination file.
2. Restore into that file:

```bash
node scripts/database-recovery.mjs restore data/backups/before-upgrade.sqlite data/restored.sqlite
node scripts/database-recovery.mjs verify data/restored.sqlite
```

3. Stop the API before switching its configured `DATABASE_PATH`. Keep the original database and its WAL/SHM files intact. The restore tool never modifies them.
4. Set `DATABASE_PATH` to the restored file, then start the matching API release. Startup applies any pending migrations; therefore an application rollback also requires the corresponding earlier release and snapshot.
5. Check `/api/v1/health`, sign in with a test account, and verify its private ride history and the assigned driver's queue/earnings. Confirm the unassigned account cannot read or act on those requests. Record the snapshot timestamp and elapsed recovery time in the deployment record.

The automated regression creates a live WAL snapshot, restores it into another file, and verifies reservations, account isolation, bearer-session validity, mutation replay and simulated settlements. This is a local recovery drill, not a measured recovery objective for the hosting environment. Restoring an older snapshot loses changes made after that snapshot; coordinate incident recovery before switching traffic.

## Status, maintenance and sessions

```bash
node --env-file-if-exists=.env scripts/operations.mjs status
node --env-file-if-exists=.env scripts/operations.mjs maintenance
node --env-file-if-exists=.env scripts/operations.mjs revoke-sessions PROVIDER_ACCOUNT_ID
```

`status` reports aggregate counts and per-route/status request totals plus average elapsed time for the last hour. Routes are templates, never raw query strings or booking IDs. Metrics are stored in the configured database; external alert delivery is not configured.

`maintenance` removes expired API sessions and rate windows, unconsumed quotes expired more than a day ago, and request metrics older than 30 days. It keeps account workspaces, ride history, consumed quotes, mutation receipts and immutable simulated settlements. Account deletion and legally appropriate retention rules need an explicit policy before live operation; do not delete financial/audit records ad hoc.

`revoke-sessions` removes all API sessions belonging to the exact provider account ID, then writes an operator audit event. It does not revoke Supabase tokens or prevent a new provider sign-in. To suspend driver access, use `driver-admin.mjs revoke EMAIL` as documented in the README; to suspend identity access, also use the identity provider's administrative controls. No public request can grant a driver role.

## Request failures

- A lost mutation response can be retried with the same Idempotency-Key and identical method/path/body. Authentication and current role checks still apply. Reusing a key for different input returns 409. Circle endpoints return the current authorized pool view after replaying the command.
- A quote expires after five minutes and does not reserve seats. Search again to review the fare if it expires or the dispatch target changes. Confirmation rechecks shared capacity.
- Five incorrect boarding codes lock the driver/request pair for 15 minutes, including across restarts and new logins. The API returns 429 and Retry-After. Wait for the window to expire; never reset counters to bypass a real abuse incident.
- An undecided reservation prevents the shared trip starting. Accept or decline each request, then verify each accepted passenger's code. If another passenger cancels after someone has boarded, use Start shared ride; the API checks readiness again.
- A storage failure during shared completion rolls back every passenger transition and simulated settlement. Check aggregate 5xx metrics and the request ID, restore database availability, then retry the same command. Do not edit individual JSON booking statuses.

Real transport incident escalation, driver reassignment, passenger notifications and payment reconciliation require additional operational workflows. The preview does not collect money or dispatch a live vehicle.
