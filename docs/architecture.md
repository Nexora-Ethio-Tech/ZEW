# Architecture

## Current implementation

The public homepage is `frontend/src/features/landing/`; it links to the account-free circle demo at `/demo` and the planned-commute demo at `/planned`. Circle UI lives in `frontend/src/features/pool/`; its API is `backend/src/modules/groups/`. The earlier planned-trip UI remains in `features/workspace.tsx`.

Optional accounts use one identity source: Supabase Auth. The frontend signs up/signs in with the provider, then exchanges its access token at `/auth/session`. The backend independently verifies the token and confirmed email; only then does it create a private rider session. Role selection and local password accounts cannot grant access. The transaction store is SQLite; there is no asynchronous remote mirroring. Payment-provider endpoints fail closed until a real integration is implemented, and the SSE stream is an authenticated simulation.

The frontend is deployable to Vercel and proxies API calls to a separately hosted persistent Fastify process. SQLite must not be deployed on Vercel's ephemeral function filesystem. See [deployment](deployment.md) for the Docker/Render backend and frontend configuration.

`place-search.tsx` calls the authenticated Photon proxy in `groups/places.ts`; arbitrary coordinates/names are stored through `/pool/place`. `street-map.tsx` is client-only Leaflet, with real configurable map tiles and confirmed pin selection. Exact pickup coordinates return only to the owning session. Search and map providers are external; road routing and live multi-user matching are still future integrations.

The runnable version is a private demo. Next.js proxies `/api/v1` to Fastify. Fastify validates input, evaluates matching and booking rules, then commits session state and audit events in one SQLite transaction. See [implementation status](implementation-status.md) for exact limits.

`backend/src/shared/store.ts` is the SQLite adapter; `backend/src/modules/matching/service.ts` contains deterministic matching rules. The main UI is `frontend/src/features/workspace.tsx`, with shared icons, dialog and schematic map under `components/`. HTTP types and the client are in `frontend/src/lib/api.ts`.

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
