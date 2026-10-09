# Deploy Zew to Vercel and Supabase

Deploy two applications: Next.js (`frontend/`) and the Fastify Node function (`backend/`). Supabase PostgreSQL holds application state; Supabase Auth verifies accounts. This is a private transport preview with staged matching and simulated payments.

Production frontend: **https://zew-blue.vercel.app**. API project: `zew-api`, production origin **https://zew-api.vercel.app**. Keep secrets in ignored operator environment files and encrypted Vercel settings.

## Database setup and migration

Use Node 24. In `backend/.env`, configure the existing Supabase project URL and an operator management token, then run from `backend/`:

```bash
node --env-file=.env scripts/provision-postgres.mjs
```

This applies `postgres/001_schema.sql`, creates the private `zew` schema and a restricted `zew_runtime` login, and saves a transaction-pooler `DATABASE_URL` in the ignored environment file. It does not reset an existing role password. The API runtime cannot change schemas or administer Auth. PostgreSQL connections verify TLS using the bundled public Supabase CA; do not disable verification.

For an existing local installation, stop local writes and capture a consistent snapshot:

```bash
node scripts/database-recovery.mjs backup data/zew.sqlite data/backups/before-supabase.sqlite
node scripts/database-recovery.mjs verify data/backups/before-supabase.sqlite
npm run db:import -- data/backups/before-supabase.sqlite
```

The import verifies integrity, checks row counts and commits all tables together. It refuses populated destinations and records the snapshot digest. Preserve the snapshot and checksum. For a fresh installation, first start the local API without `DATABASE_URL` to generate its SQLite catalog, stop it, then follow the same import. Startup requires a seeded PostgreSQL catalog; it does not seed silently.

The current project was imported on 2026-10-09, preserving three account records and the nominated driver grant. This import must not be repeated on the live database. Follow [operations](operations.md) for hosted recovery planning.

## Vercel configuration

Link each directory to its own Vercel project. Use Node 24.x and `npm ci` / `npm run build` in both. The frontend uses the Next.js preset. The backend uses no framework preset, the `api/index.ts` Node handler, and the empty `public` output directory. Its function runs in `dub1`, close to the Supabase eu-west-1 database.

| Project          | Production variables                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| API (`zew-api`)  | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `FRONTEND_ORIGIN=https://zew-blue.vercel.app`            |
| Frontend (`zew`) | `API_URL=https://zew-api.vercel.app`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

The Supabase keys above are public publishable keys, sufficient for verified user-token exchange. The database URL is server-only. Do not deploy the Supabase management token or SMTP credentials to either app. `.vercelignore` excludes environment files, local data and build caches.

`API_URL` is a public HTTPS **origin**, without `/api/v1`; the frontend validates it during the build and proxies same-origin `/api/v1` requests. Vercel API startup refuses to use ephemeral SQLite. Configure preview projects with an isolated database and explicit callback URLs before enabling preview deployments; the setup script currently writes production settings only.

After authenticating Vercel CLI and linking both directories, `node scripts/configure-vercel.mjs` from the repository root configures the strict environment allowlist from the local backend settings. It reads the CLI token without printing it.

Both projects are connected to the public GitHub repository `Nexora-Ethio-Tech/ZEW`. Their production branch is `master`; their root directories are `frontend` for `zew` and `backend` for `zew-api`. Push reviewed changes to deploy automatically:

```bash
git push origin master
```

Check both projects in Vercel after pushing. A successful frontend build does not prove the API deployed successfully. Production environment variables are configured; other branches need isolated preview settings before their deployments can operate. Commit-author permission checks still apply; resolve account identity or team access through Vercel while preserving existing history.

## Account sign-in

Run from `backend/` using the local management token:

```bash
node --env-file=.env scripts/configure-auth-origin.mjs https://zew-blue.vercel.app
```

This sets the Supabase site URL and adds `/auth/callback` and `/auth/reset-password` while preserving existing redirects, SMTP and email-confirmation settings. The invited `nexoratechnologyplc@gmail.com` account signs in at `/driver`. Other verified accounts use passenger workspaces. Confirmation is required, and frontend role selection cannot grant driver access. Existing requests and driver routing remain simulated.

Driver administration and email invitation eligibility use PostgreSQL whenever `DATABASE_URL` is set. Build the backend before running these operator scripts. See the README for commands; only request a sign-in email when the driver is ready to open it in the intended browser.

## Release checks

```bash
npm run check
npm run build
npm --prefix backend run test:postgres
```

The PostgreSQL regression creates a separate temporary schema, copies only catalogs and test driver configuration, runs two independent API instances, and removes the fixture. It requires the locally configured management token and runtime database URL. Ordinary tests use isolated SQLite fixtures and skip that external regression.

Check API health directly and through the frontend proxy. Verify denied guest access, confirmed account sessions, quote/reservation/retry/cancellation, denied passenger driver access, and the landing/planned/driver pages. Cancel live smoke-test reservations afterward. Browser smoke scripts and their dedicated Chromium setup are documented in the README; fixture-backed checks do not prove hosted database connectivity. Email confirmation requires the actual recipient to follow the link.

## Optional SQLite host

Without `DATABASE_URL`, the standalone API uses `DATABASE_PATH` and applies SQLite migrations on startup. Use one process with a persistent volume. `backend/Dockerfile` and `render.yaml` retain this alternative; it is not the Vercel architecture. Use consistent SQLite backups and verified restores as described in the operations runbook.

## Operating limits

Supabase stores private application data outside its public Data API. Domain writes currently use one advisory transaction lock across instances; load-test before increasing traffic. API limits persist in PostgreSQL, but socket-peer limits can aggregate requests behind proxies. Configure appropriate edge limits rather than trusting arbitrary forwarded IP headers.

Real fleet scheduling, transport approval, payments, notifications, external alerting, hardened session policies and verified hosted recovery remain additional work. Request IDs and aggregate metrics are available; never add bearer tokens, passenger codes or booking bodies to logs.
