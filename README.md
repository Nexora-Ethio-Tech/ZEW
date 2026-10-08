# Zew

A shared-ride idea for Addis Ababa, presented as a polished private demo. Explore an interactive landing page, try a circle of simulated riders, split an illustrative fare, and complete a demo journey.

**This is not a live transport service.** People, availability, arrival times, driver actions, dispatch controls, fares and receipts are simulated. Real payments are not connected.

## Run locally

Use **Node.js 24+** (`nvm use`), then run from the repository root:

```bash
npm run setup
npm run dev
```

The frontend runs on port 3000 and the API on port 4000. Stop both with Ctrl+C. No payment credentials, Docker or Supabase account is required to explore the demo. App-specific options are in `frontend/.env.example` and `backend/.env.example`.

- `/`: public landing page, interactive example fare calculator, optional account sign-in.
- `/demo`: account-free ride-circle workspace with sample riders and driver controls.
- `/planned`: account-free planned-commute demo.

## Try a ride circle

1. Open `/demo`. Choose a pickup and destination by search, map pin or one-time device location, or keep the example Bole → Meskel Square journey. Fictional applicants are seeded around 13 example pairs, but the journey form does not display a route list.
2. Enter a positive minimum and maximum number of people you would share with, including yourself, and any positive maximum fare in ETB. Review the server-calculated example prices for each available group size, then apply. The API chooses compatible simulated riders within those limits and locks the illustrative fare. Current demo vehicles have at most four passenger seats, so a higher maximum preference does not create a larger vehicle. A four-person Meskel Square example costs **90 ETB per person**; a solo example costs **360 ETB**.
3. Open driver space and let the sample driver Hana accept the matched group.
4. Start and complete the demo ride. My rides shows the simulated receipt and two labeled seeded examples.

Riders have a two-minute readiness window. Refresh demo restarts simulated availability. Distant, wrong-way and expired riders are rejected; driver acceptance also checks capacity and arrival before readiness ends. Sample rider matches are available near the displayed pickup and destination pairs; other Ethiopia journeys can apply but may receive a solo demo result. The map shows approximate dots derived from fictional application totals, not live or exact passenger locations. These checks do not verify actual roads, traffic, safe boarding points or legal pickup reachability. Custom journeys use a fixed illustrative 360 ETB total.

## Planned commutes

Open `/planned`, keep the Bole → Meskel Square example and click Find my ride. Choose a sample driver, confirm a demo reservation, and find the boarding code in My rides. Switch to Driver Mode, enter the code, and complete the demo trip. Switch back to Passenger Mode and open Past rides for the simulated receipt. Save and reuse a commute from the rider form. The API also supports private driver offers and consented pilot-interest records.

Sample departures are generated for the following morning in Addis time. Every session is isolated: driver controls affect only that session's sample rides. State survives refreshes and API restarts in `backend/data/zew.sqlite`. Tokens are stored as hashes in SQLite, sessions expire after 30 days, and bearer tokens must remain private.

## Verified account sign-in

Accounts are optional and require a configured Supabase Auth project with email confirmation enabled. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the frontend and matching `SUPABASE_URL` / `SUPABASE_KEY` on the API. Use public publishable keys; never place service-role credentials in frontend variables.

Sign-up does not create a local account or grant API access. After the actual confirmation link is followed, sign-in sends the provider access token to the API, which independently verifies the user and email confirmation. Self-selected roles do not grant elevated access. API logout revokes the session. Confirmed accounts still open private demo workspaces, not live transport operations.

Hard-coded local password accounts and automatic password resets have been removed. Migration 005 removes legacy local identities and their sessions while retaining guest demo data; back up existing databases before upgrading. SQLite is authoritative; the old fire-and-forget remote mirroring has been removed.

## Checks

```bash
npm run check  # Backend types + API tests + frontend types
npm run build # Both production builds
```

After building, run `npm --prefix backend start` and `npm --prefix frontend start` in separate terminals. The production frontend registers an offline-notice service worker; it never caches API responses or queues bookings/payment actions.

Browser acceptance scripts use a dedicated headless Chromium profile with debugging port 9235. Run sequentially against running applications:

```bash
node scripts/landing-browser-smoke.mjs
node scripts/group-browser-smoke.mjs
ZEW_CHECK_PWA=1 node scripts/browser-smoke.mjs
```

Set `ZEW_BASE_URL` to override the frontend origin. Screenshots are written to `/tmp`. Circle tests stub public tiles and place search; `ZEW_LIVE_PLACES=1` enables optional live search. No test reads the user's actual GPS position.

## Maps and providers

The demo uses Leaflet with configurable OpenStreetMap tiles and a Photon search proxy. Search results must be tagged as Ethiopia; map pins and device locations are limited to a coarse Ethiopia bounding box, which does not establish the exact border or road reachability. Network access is required. Photon is a low-volume public demo service; production needs a suitable managed or self-hosted provider. Set `PHOTON_URL`, `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` to configure providers. Respect [Photon limits](https://github.com/komoot/photon#demo-server) and the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, normal caching, no prefetch/offline tile downloading. Search text and an Addis Ababa ranking point reach Photon; the viewed map area reaches the tile provider. Device GPS is not reverse-geocoded.

Fonts and marker icons are served locally. Tile errors are shown without silently changing providers or attribution. Optional OSRM routing has an illustrative fallback; neither indicates verified road safety. Real-payment endpoints return 501 until a provider and durable ledger are integrated. Zew never collects a payment PIN.

## Deployment and structure

[Deploy to Vercel](docs/deployment.md): the Next.js frontend runs on Vercel; the separate SQLite API needs persistent hosting. A backend Dockerfile and optional paid Render blueprint are included. Setting `API_URL` to a reachable public HTTPS backend is required for Vercel builds.

```text
frontend/src/app/        Public, demo and planned routes
frontend/src/features/   Landing, verified auth, circles, planned journey UI
frontend/src/lib/        API, auth, theme and localization
backend/src/modules/     Auth verification, trips, matching, groups, routing, stream
backend/src/shared/      Transactional SQLite store and migrations
backend/tests/           API and regression tests
scripts/                 Dev launcher and browser acceptance checks
infrastructure/          Reserved future PostGIS schema
```

See [implementation status](docs/implementation-status.md), [architecture](docs/architecture.md) and [ride-circle rules](docs/product/ride-circles.md). Real multi-user operations, approved roles, real payments and operational safety workflows are future work.
