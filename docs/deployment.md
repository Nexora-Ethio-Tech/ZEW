# Deploy the Zew demo

Zew has two applications: a Next.js frontend for Vercel and a Fastify API that needs a persistent SQLite disk. Deploying only the frontend does not deploy the API. This release is a polished **private demo**, not a live transport or payment service.

## 1. Deploy the persistent API

The repository includes `backend/Dockerfile` and an optional Render blueprint (`render.yaml`). The Render blueprint uses a paid starter service because persistent disks are not available on the free service; review the provider's current pricing before creating it. You can use another Docker host with persistent storage instead.

Build from the repository root:

```bash
docker build -t zew-api ./backend
docker volume create zew-data
docker run -d --name zew-api -p 4000:4000 \
  --mount source=zew-data,target=/app/data \
  -e FRONTEND_ORIGIN=https://YOUR-FRONTEND.vercel.app \
  zew-api
```

The application runs as the non-root `node` user; a mounted disk must be writable by UID 1000. `DATABASE_PATH` defaults to `/app/data/zew.sqlite` in the container. Migrations run on startup and must remain bundled in the image. Use one API instance for this SQLite adapter. Put HTTPS in front of the API, preserve the volume on redeployment, and back up the database with SQLite's backup mechanism (not a copy of a live WAL file).

For a build behind an existing HTTPS proxy, pass the environment's proxy variables by name and its trusted certificate as a BuildKit secret. Never disable TLS verification:

```bash
docker build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY \
  --secret id=network_ca,src="$NODE_EXTRA_CA_CERTS" -t zew-api ./backend
```

Check `https://YOUR-API/api/v1/health`: expect `status: ok`, `service: zew-api`, `mode: demo`.

## 2. Deploy the frontend to Vercel

Import `Nexora-Ethio-Tech/ZEW` into your Vercel account:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `frontend` |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| `API_URL` | Your persistent API's public HTTPS **origin**, without `/api/v1` |

`frontend/vercel.json` records the build settings. The Vercel build fails with a specific message if `API_URL` is missing, includes credentials or a path, or points to localhost. The browser uses same-origin `/api/v1`; only the server sees `API_URL`. Set it for both Preview and Production environments and rebuild after changing it.

Deploy from Vercel's Git integration, or from `frontend/` with an authenticated Vercel CLI (`vercel --prod`). Never commit deployment tokens or `.env.local`. No Vercel deployment is implied by a successful local build.

## 3. Optional verified accounts

The demo works without an account at `/demo` and `/planned`. Account sign-in is deliberately unavailable until an identity provider is configured.

1. Use a Supabase project with email/password authentication and **Confirm email** enabled. Configure your site's Production and Preview URLs in the project's allowed redirect URLs, and configure email delivery for your deployment.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the Vercel frontend. These are public client settings; never put a service-role key in `NEXT_PUBLIC_*`.
3. Set matching `SUPABASE_URL` and `SUPABASE_KEY` on the API. A public publishable key is sufficient for server-side user-token verification. No database mirroring or service-role key is needed.
4. Redeploy both applications. Sign up with a new test email, follow the actual confirmation link, and sign in. The API calls Supabase to verify the access token and requires `email_confirmed_at` before issuing its own session. Invalid and unconfirmed identities are rejected. Account metadata cannot grant driver/operator/admin permissions.

Accounts reopen their durable workspaces across sign-ins; guest workspaces remain separate. Migration 010 adds driver invitations and assignments, with new test requests routed to the nominated Nexora driver. The confirmed invited account opens `/driver`; other accounts use the passenger workspace. These are test transport operations and simulated payments. Allow `https://YOUR-FRONTEND/auth/callback` in Supabase redirect URLs and configure working SMTP delivery before inviting the driver. Use the local operator scripts documented in the README to select or disable test routing and revoke access.

Sessions expire after 30 days. API logout revokes the session without deleting account ride data. Seeded local passwords have been retired. Back up existing SQLite data before upgrading through migrations 010–013. See the [operations runbook](operations.md) for consistent backup, verified restore into a new file and a recovery drill.

## 4. Release checks

From the repository root:

```bash
npm run setup
npm run check
npm run build
```

Start the API and frontend, then run the existing browser checks against the deployed frontend (or a dedicated local production instance). Launch a dedicated headless Chromium profile first:

```bash
chromium --headless --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-port=9235 --user-data-dir=/tmp/zew-acceptance about:blank
ZEW_BASE_URL=https://YOUR-FRONTEND node scripts/landing-browser-smoke.mjs
ZEW_BASE_URL=https://YOUR-FRONTEND node scripts/group-browser-smoke.mjs
ZEW_BASE_URL=https://YOUR-FRONTEND ZEW_CHECK_PWA=1 node scripts/browser-smoke.mjs
```

Run browser checks sequentially: they share the dedicated test profile and create test-only demo data. Map tiles are stubbed and place search is mocked by default in the circle test; set `ZEW_LIVE_PLACES=1` only for the optional provider check. Account-provider email delivery needs a separate live check with your configured project.

Verify the landing page, demo fare changes, booking/completion/receipt, saved commute persistence, mobile layout, production offline fallback, and `/api/v1/health` through the frontend proxy.

## Demo boundaries

People, arrival times, driver actions, dispatch controls, fare estimates, and receipts are simulated. Real-payment endpoints fail closed with 501; no PIN is collected, no USSD request is sent, and no real payment is marked successful. An optional OSRM route is provider data; the built-in distance fallback is illustrative and does not verify route safety. Production transport requires a durable multi-user data model, approved driver/operator roles, provider integrations, operational controls, and payment reconciliation.

## Operational checks

Deploy frontend and API together: booking confirmation now requires a server-issued quote ID. Migrations 011–013 run at API startup; the new frontend uses shared departure controls and retry keys. Existing workspaces are preserved. A rollback must use a matching application release and a verified pre-upgrade snapshot; do not run old dispatch code against the expanded schema.

Use `scripts/operations.mjs status` from the backend directory for aggregate route/status counts and average latency. Persisted limits use socket peer and workspace identity; because the Next.js proxy aggregates socket peers, configure edge throttling and review limits for expected traffic. Do not enable arbitrary forwarded-IP trust. Request IDs are returned in `X-Request-Id`; do not add bearer headers or booking bodies to proxy logs. Metric cleanup retains 30 days when maintenance runs.
