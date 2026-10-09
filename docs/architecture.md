# Architecture

## Current implementation

The public homepage is `frontend/src/features/landing/`; it links to ride circles at `/rides` and planned commutes at `/planned`. The former `/demo` path redirects to `/rides`. Circle UI lives in `frontend/src/features/pool/`; its API is `backend/src/modules/groups/`. The planned-trip UI lives in `features/planned/`, with separate journey fields, matching results, reservation details, records and header components. Driver and operator code is not bundled into that passenger workspace.

Accounts use one identity source: Supabase Auth. The frontend supports password and email-link sign-in, then exchanges the provider access token at `/auth/session`. The API independently verifies the token and email confirmation. Migration 010 adds durable account workspaces, server-owned driver invitations and assigned requests. An invitation binds to the confirmed provider user ID once; role selection, URL parameters and user metadata cannot grant permissions. Roles are checked against the current grant on every request, so revocation affects existing sessions. Logout removes the bearer session while preserving account state.

`/driver` is a separate interface. `/driver/dashboard` returns only requests assigned to that driver; `/driver/requests/:id/action` authorizes the assignment before changing the passenger's canonical workspace and writing an audit event in one SQLite transaction. Client-supplied workspace/session IDs are never accepted. Starting a ride requires the passenger's server-generated boarding code, which is excluded from driver responses and logs. Stale requests and overlapping vehicle trips fail closed. A matching Idempotency-Key replays the committed command result; reusing the key for another payload is rejected. Shared planned departure capacity is checked transactionally across workspaces.

For the requested test setup, `dispatch_settings.test_driver_id` targets the invited Nexora account for new requests. This setting is managed by a local operator command, has no public UI switch, and does not represent live fleet selection. Disabling it prevents new assignments. The passenger matching catalog and transport estimates remain simulated. Payment-provider endpoints return 501 until a real integration is implemented; the map SSE remains an authenticated simulation.

Migration 010 retains existing session data in workspaces, selecting the most recent workspace per confirmed account for future sign-ins; previous workspace rows are retained. Back up SQLite before applying it. Guest sessions continue to own distinct workspaces. Request ownership lives in `dispatch_requests`, and driver actions have separate `dispatch_events`; API bearer tokens remain hashed in `sessions`.

The frontend is deployable to Vercel and proxies API calls to a separately hosted persistent Fastify process. SQLite must not be deployed on Vercel's ephemeral function filesystem. See [deployment](deployment.md) for the Docker/Render backend and frontend configuration.

`place-search.tsx` calls the authenticated Photon proxy in `groups/places.ts`; Ethiopia-bounded coordinates/names are stored through `/pool/place`. `street-map.tsx` is client-only Leaflet, with real configurable map tiles, confirmed pin selection, and approximate dots derived from the example application totals. Thirteen schematic journey pairs seed 14 fictional applicants each; `/pool/demo-route` selects a pair and refreshes availability in one SQLite transaction. Matching requires proximity to both example endpoints and does not verify road reachability. `/pool/criteria` stores positive min/max group size and fare ceiling preferences; `/pool/apply` can receive those preferences atomically, selects eligible sample riders within the available four-seat demo vehicle capacity, and locks the server-calculated fare in one SQLite transaction. Exact pickup coordinates return only to the owning session. Search and map providers are external; road routing and live multi-user matching are still future integrations.

The runnable version is a private preview, without live transport operations. Next.js proxies `/api/v1` to Fastify. Fastify validates input, evaluates matching and booking rules, then commits session state and audit events in one SQLite transaction. Group and planned-journey catalog records are seeded by migrations 006–009 and loaded from SQLite at API startup. They are no longer embedded in frontend components or backend model arrays. The catalog is read at startup; restart the API after controlled catalog edits. Session-owned journey states remain separate from the shared catalog. See [implementation status](implementation-status.md) for exact limits.

`backend/src/shared/store.ts` is the SQLite adapter; `backend/src/modules/matching/service.ts` contains deterministic matching rules. Planned HTTP handlers and schemas live in `backend/src/modules/planned/`; its service owns reservations, cancellation, commute persistence and departure generation. `app.ts` composes plugins and access checks. The passenger UI is split between `frontend/src/features/pool/` and `frontend/src/features/planned/`, with shared icons, dialogs and maps under `components/`. HTTP types and the client are in `frontend/src/lib/api.ts`.

The database/provider diagram below is the target pilot architecture. PostGIS Docker files remain available for that phase; those external integrations are not yet connected.

```text
Browser / installable PWA
        │ HTTPS JSON
        ▼
Fastify API ── PostgreSQL + PostGIS
        │              │
        │              └── users, trips, routes, match proposals, audit events
        ├── map/routing provider (server-side)
        ├── payment provider (webhook verified)
        └── SMS/push provider
```

## Frontend (`frontend/`)

- `src/app/`: routes and layouts. Route groups keep marketing, rider, driver, and operator views separate.
- `src/features/`: a feature owns its API calls, UI, state, and tests (for example `trips/`, `matching/`).
- `src/components/`: reusable, product-neutral UI primitives.
- `src/lib/`: API client, validation, formatting, auth helpers.

Keep route/network logic out of generic UI components. The browser never receives payment secrets or provider webhook secrets.

## Backend (`backend/`)

- `modules/<domain>/routes.ts`: HTTP boundary, authentication and input validation.
- `modules/<domain>/service.ts`: business rules and transaction boundaries.
- `modules/<domain>/repository.ts`: database reads/writes only.
- `modules/matching/`: candidate filtering and ranking; it must return a reason for every rejection.
- `plugins/`: cross-cutting Fastify plugins (database, auth, rate limit, error handler).
- `shared/`: errors, IDs, enums, telemetry utilities; not business logic.

The API is the source of truth. Do not let a frontend decide fare, payout, participant eligibility, trip transition, or payment outcome.

## Core data model

| Entity | Important fields |
| --- | --- |
| User | role, phone verification, approval status |
| DriverProfile / Vehicle | verification status, legal seats, expiry dates |
| Commute | origin/destination geometry, time window, days |
| PlannedTrip | driver, route geometry, departure window, open seats, status |
| PickupPoint | approved point, geometry, corridor, safety status |
| MatchProposal | trip, rider, score, rejection/decision reason, expiry |
| Booking | acceptance, boarding code, state, fare snapshot |
| Payment / Payout | provider reference, immutable amount/currency/status |
| AuditEvent | actor, entity, before/after, timestamp, request ID |

Use PostGIS `geography`/`geometry` plus spatial indexes for distance and corridor queries. Routing/detour estimates belong in a server-side adapter so a provider can be changed later.

## Refactor boundaries (2026-10-09)

- Planned matching operates on an explicit set of server-generated departures. Searches generate catalogue departures in shared 15-minute slots; reservations use the same generator. Inventory and duplicate checks use both trip ID and actual departure, allowing the same commute on another day. Fares remain catalogue values calculated by the API. Driver capacity and disabled dispatch routing are reflected in results before confirmation; the transaction repeats capacity checks when reserving.
- `frontend/src/lib/session.ts` owns the browser session cache and guest bootstrap. A delayed guest response cannot overwrite a verified sign-in, and a delayed unauthorized response cannot clear a newer session. Expired account polling does not silently switch to a guest. `/auth/me` outages preserve the existing cache and display an error. Cached roles never authorize backend operations.
- `PassengerAccess` provides the verified account to passenger views. Both signed-in homepage entry and `/planned` use the same passenger boundary; drivers continue to use `/driver`.
- Preview listing details show only API-provided fields. Invented driver ratings, ride counts, plates and amenities were removed. The payment action opens preview information and does not imply a connected payment provider.

## Shared departures and durable commands

Migration 011 introduces `planned_departures`, keyed by assigned driver, catalogue trip and actual departure. `dispatch_requests.departure_id` links each private passenger reservation to it. Capacity is capped by both the catalogue and the assigned vehicle. First acceptance changes the departure from open to boarding and closes new inventory. The driver may accept other existing reservations on that same departure, but cannot accept an unrelated trip while one is active.

Each planned reservation records boarding verification separately. Once every remaining reservation is accepted and verified, `dispatch/departures.ts` moves every affected workspace into progress in a single SQLite transaction. Completion moves all participants together and inserts one immutable simulated settlement per reservation. If any workspace update fails, all trip and ledger writes roll back. Cancellation is allowed before boarding verification. A verified passenger waiting after another passenger cancels can be released by `POST /driver/departures/:id/start`, which repeats the readiness checks.

Migration 012 stores private, five-minute booking quotes. `POST /matches` returns quote IDs on available listings; `POST /booking-quotes` supports explicit quote creation. `POST /bookings` accepts only `{quoteId}`. The server consumes the stored journey/fare snapshot and allocates seats in the same transaction. Expired or foreign quotes fail; consumed quotes return the original reservation. A changed dispatch target requires a fresh quote. A quote does not hold inventory.

`shared/commands.ts` propagates a validated Idempotency-Key using AsyncLocalStorage, then reads/writes `mutation_receipts` inside the mutation transaction. Keys are scoped to an authenticated workspace and compared against a canonical method/path/body digest. Access checks still precede replay. The stored domain result is replayed; circle endpoints additionally return the current authorized pool view. Keys are currently retained with account data. The frontend retains an uncertain command key in session storage and clears it after a definitive response. It never automatically queues offline operations.

`shared/rate-limits.ts` stores hashed subjects and counters in SQLite. Limits are 600 requests per socket peer per minute and 120 per domain workspace per minute; forwarding headers are not trusted. Five failed boarding guesses lock that driver/request pair for 15 minutes. Guess counters are written after the failed trip transaction rolls back, so API restarts cannot reset them. Reverse proxies aggregate socket peers; configure edge limits and capacity before public traffic.

Migration 013 stores aggregate route-template/status/minute counts and elapsed time, with no query strings, tokens, codes or bodies. Logs contain request IDs and methods; server error logs omit arbitrary exception content. Operator tools have host access as their authorization boundary. Database files and recovery snapshots use mode 0600. See [operations](operations.md) for the single-instance SQLite recovery procedure and retention limits.
