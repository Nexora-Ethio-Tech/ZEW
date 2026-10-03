# Zew

A shared-ride demo for any journey, not only commutes. Separate Next.js frontend and Fastify API, with real street maps, place search, persistent local data and a simulated rider journey.

## Run locally

Use **Node.js 24+** (`nvm use` if you use nvm). From this directory:

```bash
npm run setup
npm run dev
```

Open **http://localhost:3000**. The API runs at `127.0.0.1:4000`. Stop both with Ctrl+C. Docker, payment keys, and map keys are not required. Optional configuration is documented in each app's `.env.example`.

## Try the journey

The homepage now features **ride circles**:

1. Replace the example pickup/destination: type a street, landmark or city, press **Search**, then select a result. Or use **Use my location**, or **Set pickup/destination on map** and confirm a pin. Locations are not restricted to fixed stops.
2. Add Sara, Bereket, and Eden. Your Meskel Square demo share changes **360 → 180 → 120 → 90 ETB**. Remove or skip people as you like.
3. Request the group when the fare suits you. Open Driver space and let Hana accept it, then start and complete the demo ride.
4. Check My rides for the receipt and two seeded example journeys.

Riders become unavailable after two minutes; **Refresh demo** starts a new simulated availability window. Distant, wrong-way and expired riders are rejected. Driver acceptance also checks capacity and travel time to the final pickup. All timings and profiles remain fictional. [Read the full group and location rules](docs/product/ride-circles.md).

### Planned commutes

The original experience is still available from **Planned commutes** (`/planned`):

1. In **Find a ride**, keep the suggested Bole → Meskel Square route and departure time. Click **Find my ride**.
2. Choose a sample driver and confirm your reservation.
3. In **My rides**, note the four-digit boarding code.
4. Open **Driver space**, enter that code, then complete the demo trip.
5. Return to **My rides → Past rides** to see the simulated receipt.
6. Save a commute, create/cancel a driver offer, or try the local pilot-registration form.

Sample trips are created for the following morning at 08:00/08:15 Addis time. Each browser has a private sandbox; trip offers are not published to other users. Data survives refreshes and API restarts. The browser stores a bearer token; the API stores its hash and session data in `backend/data/zew.sqlite`.

## What is implemented

- Responsive rider and driver screens, loading/empty/error states, form labels and native dialogs.
- Matching by corridor, ordered stop direction, route containment, time window, and seat availability, with rejection reasons.
- Transactional seat reservations, duplicate protection, boarding codes, cancellation and completion state checks.
- Saved commutes, driver offers, simulated receipts/payout totals, consented local registration, activity events.
- Input validation, session ownership checks, rate limits, SQLite persistence and API tests.
- Install manifest/icons and a production-only service worker that provides an offline notice. API and booking data are never cached.

**This is a demo, not a live ride service.** The homepage uses Leaflet/OpenStreetMap streets and Photon place search. People, driver responses, fares and pickup ETAs remain simulated. Custom journeys use an explicitly illustrative 360 ETB total, not a distance-based quote. Device location can supply a one-time pickup reading anywhere with permission. Continuous GPS, phone sign-in, verified rider/driver/operator roles, road routing, notifications, and real payments remain future integrations. SQLite is a local-demo adapter; the existing Docker/PostGIS configuration is reserved for the production data layer.

Map/search need internet. Photon is a low-volume public demo service, not a production SLA: searches are explicit, cached and throttled. Use a managed/self-hosted provider for production. Configure `PHOTON_URL` in the backend and `NEXT_PUBLIC_MAP_TILE_URL`/`NEXT_PUBLIC_MAP_ATTRIBUTION` in the frontend. Respect [Photon limits](https://github.com/komoot/photon#demo-server) and the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, normal browser caching, no tile prefetch or offline downloading. Search text reaches Photon; the viewed map area reaches the tile provider. Device GPS is not sent for reverse geocoding.

## Commands

```bash
npm run check  # Backend types + tests, frontend types
npm run build # Build both applications
npm run format # Format application source with Prettier
```

After a build, start each app in its own terminal with `npm --prefix backend start` and `npm --prefix frontend start`. The production frontend registers the offline service worker; installation support varies by browser.

For the optional browser acceptance check, launch a dedicated headless Chrome profile with debugging port 9235, then run `node scripts/browser-smoke.mjs` while the apps are running. The script creates test-only demo data and writes screenshots under `/tmp`. Set `ZEW_BASE_URL` to override the frontend URL and `ZEW_CHECK_PWA=1` to check the production offline fallback.

Run `node scripts/group-browser-smoke.mjs` for the circle flow, fare changes, driver acceptance, GPS permissions, live place search, map pins, persistence and mobile layout. It uses simulated coordinates, never your actual device location. Automated tile requests are stubbed to avoid fetching public tiles during scripted map movement; actual tiles are loaded in normal interactive use.

## Structure and further reading

```text
frontend/       Web UI, API client, PWA assets
backend/        API, matching, trip rules, SQLite adapter, tests
docs/           Product brief, architecture, research, AI guidelines
infrastructure/ Reserved PostGIS initialization
scripts/        Combined dev launcher and browser acceptance check
```

Start with [the beginner guide](docs/START-HERE.md), [architecture](docs/architecture.md), and [implementation status](docs/implementation-status.md). The source deck remains `zew-pitch-deck.pdf`.
