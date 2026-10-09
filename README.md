# Zew

A shared-ride product for Ethiopia, with journey planning, group matching, fare splitting, and ride records. The hosted private preview runs on Vercel with Supabase PostgreSQL. SQLite remains available for local development.

Hosted frontend: https://zew-blue.vercel.app — passenger routes `/rides` and `/planned`, separate driver workspace `/driver`.

**Live transport is not connected.** Seeded rider and driver records, availability, arrival times, dispatch actions, and fares are staged. No real payment is collected.

## Run locally

Use **Node.js 24+** (`nvm use`), then run from the repository root:

```bash
npm run setup
npm run dev
```

Without `DATABASE_URL`, local development uses SQLite. If `backend/.env` contains the hosted `DATABASE_URL`, local API changes affect that Supabase database; use a separate project for development.

The frontend runs on port 3000 and the API on port 4000. Stop both with Ctrl+C. No payment credentials, Docker or Supabase account is required to explore the passenger preview. Migrations 001–013 run transactionally on API startup; 006–009 populate the transport catalog and 010 adds account workspaces and driver assignments, 011 adds shared departures, retry receipts, durable limits and simulated settlements, 012 adds private booking quotes, and 013 adds aggregate request metrics and operator audit records. Back up an existing `backend/data/zew.sqlite` before upgrading. App-specific options are in `frontend/.env.example` and `backend/.env.example`.

- `/`: public landing page, interactive API-backed fare calculator, optional account sign-in.
- `/rides`: passenger ride-circle workspace with staged applications. `/demo` redirects here for existing links.
- `/planned`: planned-commute workspace.
- `/driver`: separate driver sign-in and assigned-request workspace.

## Try a ride circle

1. Open `/rides`. Choose a pickup and destination by search, map pin or one-time device location, or keep the initial Bole → Meskel Square journey. Staged applications are stored in the database catalog for 13 journey pairs; the form does not display a route list.
2. Enter a positive minimum and maximum group size and any positive fare ceiling in ETB. Review the API-calculated projected shares, then apply. Matching selects eligible records and locks the projected fare. Configured vehicles currently have up to four passenger seats.
3. The API assigns the configured test driver. In a separate browser profile, the driver opens `/driver` and accepts the request.
4. The passenger sees a boarding code. The driver enters it to start the ride, then completes it. Both accounts receive the final state; My rides stores the passenger receipt.

Riders have a two-minute readiness window. Refresh availability restarts the staged window. Distant, wrong-way and expired records are rejected; driver acceptance also checks capacity and arrival before readiness ends. Matching is available near catalogued pickup and destination pairs; other Ethiopia journeys can apply but may receive a solo result. Map dots show approximate area totals, never live or exact passenger locations. These checks do not verify actual roads, traffic, safe boarding points or legal pickup reachability. Custom journeys use a projected total from the database catalog.

## Planned commutes

Open `/planned`, keep the initial Bole → Meskel Square journey and click Find my ride. Choose the number of seats to reserve, select a listed example trip, review the seat count and total, confirm a preview reservation, and find the boarding code in My rides. The assigned driver accepts and verifies boarding from their separate `/driver` workspace. Seats are reserved across passenger workspaces in the same database transaction as the assignment. Save and reuse a commute from the rider form.

Sample departures use shared 15-minute time slots derived from the database catalog for the requested date. The same route can be reserved on different departure dates; accounts share inventory for the same trip and departure. Passenger workspaces are private. Drivers can read a limited request summary and perform authorized transitions only for requests assigned to them. Confirmed accounts reuse their durable workspace across sign-ins; guest workspaces remain isolated. State survives refreshes and API restarts in Supabase PostgreSQL when `DATABASE_URL` is set, or `backend/data/zew.sqlite` for local SQLite. Tokens are stored as hashes in the database, sessions expire after 30 days, and bearer tokens must remain private.

## Driver test account

Migration 010 creates an invitation for `nexoratechnologyplc@gmail.com` and sets it as the target for **new test requests**, including ride circles and planned reservations. This is explicit test routing, not live fleet matching. The invitation binds to the confirmed Supabase user ID on the first successful sign-in. Browser role selection, URL parameters and provider user metadata cannot grant driver access.

Configure Supabase email delivery and allow `http://localhost:3000/auth/callback` under Auth redirect URLs. The sign-in screen supports email links as well as passwords. To send the invited driver a confirmation/sign-in email, run from `backend/` after starting the API once:

```bash
node --env-file=.env scripts/invite-driver.mjs nexoratechnologyplc@gmail.com http://localhost:3000/auth/callback
```

For operator-managed SMTP setup, populate the optional management-token and SMTP variables from `backend/.env.example` in the ignored `backend/.env`, then run `node --env-file=.env scripts/configure-auth-email.mjs` from `backend/`. It updates only email configuration and adds the current frontend callback to the existing redirect allowlist, then verifies the saved settings. Email confirmation stays enabled. These credentials are never needed by the frontend.

Open the email link in the browser used for driving. It opens `/driver` after verification. Use a different browser profile or an incognito window for the passenger. The driver can accept, decline, verify the four-digit boarding code, complete rides, and inspect history and simulated earnings. One vehicle trip can be active at a time. Planned reservations for the same departure can be accepted together; each passenger supplies their own boarding code. All accepted passengers start and complete together, and undecided requests must first be accepted or declined. Boarding closes the departure to new reservations. Passengers may cancel before their boarding code is confirmed. The existing two-minute circle readiness rule still applies.

Operator commands, run from `backend/` after `npm run build`, manage invitations and the temporary routing target. There is no public role-grant endpoint:

```bash
node --env-file=.env scripts/driver-admin.mjs route nexoratechnologyplc@gmail.com
node --env-file=.env scripts/driver-admin.mjs route off
node --env-file=.env scripts/driver-admin.mjs invite driver@example.com 'Driver name' 'Vehicle description' 4
node --env-file=.env scripts/driver-admin.mjs revoke driver@example.com
```

Disabling test routing makes new requests fail closed until a driver is configured. Existing assignments keep their owner. Revocation takes effect on existing sessions. Driver invitations represent application access, not license or vehicle verification. An SMTP `535 5.7.8` error means the mail provider rejected its credentials; update them in Supabase, then resend. No account is marked confirmed locally to bypass email delivery.

## Verified account sign-in

Accounts are optional and require a configured Supabase Auth project with email confirmation enabled. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the frontend and matching `SUPABASE_URL` / `SUPABASE_KEY` on the API. Use public publishable keys; never place service-role credentials in frontend variables.

Sign-up does not create a local account or grant API access. After the actual confirmation link is followed, sign-in sends the provider access token to the API, which independently verifies the user and email confirmation. The API assigns the driver role only from a server-owned invitation; all other accounts are riders. API logout revokes the session without deleting the account's ride records. Confirmed accounts still operate in a preview environment, without live transport or real payments.

Hard-coded local password accounts and automatic password resets have been removed. Migration 005 removes legacy local identities and their sessions while retaining guest preview data; back up existing databases before upgrading. The configured database is authoritative; there is no asynchronous mirroring between SQLite and Supabase.

## Checks

```bash
npm run check  # Backend/frontend types, API + session tests, deployment configuration
npm run build # Both production builds
```

After building, run `npm --prefix backend start` and `npm --prefix frontend start` in separate terminals. The production frontend registers an offline-notice service worker; it never caches API responses or queues bookings/payment actions.

Browser acceptance scripts use a dedicated headless Chromium profile with debugging port 9235. Run sequentially against running applications:

```bash
node scripts/landing-browser-smoke.mjs
node scripts/group-browser-smoke.mjs
ZEW_CHECK_PWA=1 node scripts/browser-smoke.mjs
node --import ./backend/node_modules/tsx/dist/loader.mjs scripts/driver-browser-smoke.mjs
node --import ./backend/node_modules/tsx/dist/loader.mjs scripts/planned-browser-smoke.mjs
```

Set `ZEW_BASE_URL` to override the frontend origin. Screenshots are written to `/tmp`. Circle tests stub public tiles and place search; `ZEW_LIVE_PLACES=1` enables optional live search. No test reads the user's actual GPS position.

## Maps and providers

The ride map uses Leaflet with configurable OpenStreetMap tiles and a Photon search proxy. Search results must be tagged as Ethiopia; map pins and device locations are limited to a coarse Ethiopia bounding box, which does not establish the exact border or road reachability. Network access is required. The public Photon service has low-volume usage limits; production needs a suitable managed or self-hosted provider. Set `PHOTON_URL`, `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` to configure providers. Respect [Photon limits](https://github.com/komoot/photon#demo-server) and the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, normal caching, no prefetch/offline tile downloading. Search text and an Addis Ababa ranking point reach Photon; the viewed map area reaches the tile provider. Device GPS is not reverse-geocoded.

Fonts and marker icons are served locally. Tile errors are shown without silently changing providers or attribution. Optional OSRM routing has an illustrative fallback; neither indicates verified road safety. Real-payment endpoints return 501 until a provider and durable ledger are integrated. Zew never collects a payment PIN.

## Deployment and structure

[Deploy to Vercel](docs/deployment.md): separate Next.js and Fastify Vercel projects share the Supabase PostgreSQL database through the API. Set the server-only `DATABASE_URL` to a restricted transaction-pooler login. `API_URL` must be the API’s public HTTPS origin. A Dockerfile and Render blueprint remain available for the local SQLite hosting alternative.

```text
frontend/src/app/        Public, rides and planned routes
frontend/src/features/   Landing, verified auth, circles, planned journey UI
frontend/src/lib/        API, auth, theme and localization
backend/src/modules/     Auth verification, trips, matching, groups, routing, stream
backend/src/shared/      PostgreSQL/SQLite adapters and transactional persistence
backend/tests/           API and regression tests
scripts/                 Dev launcher and browser acceptance checks
infrastructure/          Reserved future PostGIS schema
```

See [implementation status](docs/implementation-status.md), [architecture](docs/architecture.md) and [ride-circle rules](docs/product/ride-circles.md). Passenger-to-driver assignments and account role enforcement are implemented for testing. Live fleet matching, real payments and operational safety workflows are future work.

The isolated driver and planned browser checks use an in-memory API with test identities and never alter your configured database. The planned check covers a two-seat quote and reservation, cancellation, saved routes, search focus during polling and mobile layout. Frontend session tests use the already-installed backend TypeScript loader; run `npm run setup` before checking. Migrations 011–013 preserve existing workspaces and backfill prior dispatch records. The PostgreSQL adapter uses `pg`. The browser checks also cover a lost confirmation response and a shared departure with two private passenger reservations.

## Reliable reservations and recovery

Search results include a private quote valid for five minutes. Confirmation uses its server-issued `quoteId`; fare, driver assignment and seats cannot be supplied by the client. Inventory is rechecked transactionally. An expired quote prompts a fresh search. The browser retains a random `Idempotency-Key` after network failures so retrying cannot duplicate the committed mutation. Retry storage contains digests and keys, not request bodies or boarding codes.

Boarding allows five failed code guesses per driver/request in 15 minutes, persisted across restarts and new sign-ins. The API also persists socket-peer and workspace request limits. Earnings come from append-only simulated settlement rows, in integer ETB minor units; one shared departure counts as one completed driver trip.

Use the [operations and recovery runbook](docs/operations.md) for Supabase recovery planning, local SQLite backup/restore, aggregate request metrics, maintenance and account-session revocation. Browser bearer storage and 30-day sessions still need a hardened production session policy; operator session revocation does not disable a Supabase identity or prevent a fresh provider sign-in.
