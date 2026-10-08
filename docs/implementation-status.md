# Implementation status

Updated 2026-10-08. Zew is a private, persistent ride demo with deployment tooling. It is not a live transport service or a production payments system.

| Area | Current behavior |
| --- | --- |
| Landing | Responsive city illustration, interactive example fare calculator, local fonts, light/dark themes, English/Amharic/Oromo selection |
| Demo routes | `/demo` for circles; `/planned` for legacy planned rides; homepage for public introduction and optional verified accounts |
| Circles | Thirteen seeded Ethiopia example journey pairs with 14 fictional applicants each, no visible route picker, rider-entered positive min/max group size and fare ceiling, server-selected sample group on application within four-seat demo vehicle capacity, two-minute readiness, direction/capacity checks, Ethiopia-bounded coordinates, locked quote, simulated driver acceptance, completion and receipts |
| Demand map | Sixteen approximate example areas rendered as 182 pickup and 182 destination dots derived from fictional application totals; no cross-session or individual location data |
| Planned rides | Server-side matching, transactional reservation, duplicate protection, boarding codes, cancellation/completion, saved commutes |
| Authentication | Optional Supabase email/password sign-in; server verifies provider token and confirmed email before issuing an API session; no local password login or role escalation |
| Seed data | Relative future Addis departures, explicit illustrative rider/history fixtures; no seeded password accounts or password-reset migration |
| Persistence | Authoritative local SQLite session documents and transactional activity records; guest demos retained across restarts; logout revokes API token |
| Payments | No real provider integration; initiation, webhook and status routes fail closed with 501; no phone/PIN collection in the payment screen; completion creates a simulated receipt |
| Routing | Optional OSRM call; illustrative local distance/ETA fallback, not road verification |
| Streaming | Authenticated bearer-header SSE with simulated driver ticks; no session tokens in URLs; idle timer does not keep tests alive |
| Driver/support/admin controls | Private demo views, not verified roles, dispatch operations or driver approval workflows |
| Offline | Production service worker caches only an offline notice; no API, auth, trip or payment caching |
| Deployment | Vercel frontend configuration, HTTPS backend-origin validation, backend Dockerfile, optional Render blueprint and deployment guide |

The old browser sign-up bypass and fake email-checked continuation have been removed. Sign-up errors are surfaced; no API session is created before confirmed provider identity. Existing local identities and associated sessions are retired by migration 005. A public key no longer attempts asynchronous database mirroring.

All validation commands must be rerun after changes. `npm run check` includes both type checks and API tests; `npm run build` builds both apps. Browser scripts cover landing/auth boundaries, circles, planned reservations, receipts, persistence, mobile layouts, and the production offline fallback. Tile requests are stubbed; circle place-search is mocked unless explicitly opted into live provider testing. Supabase email delivery and real deployment need configured provider accounts and live verification.

## API boundaries

All paths use `/api/v1`. `/health`, `/session`, and `/auth/*` have their own authentication rules. Domain operations require a session bearer header. A guest session owns only its private demo state.

- `POST /auth/session`: exchange a server-verified, email-confirmed Supabase access token for a private rider session.
- `GET /auth/me`: return the stored verified account for a valid API session; guest sessions receive 401.
- `POST /auth/logout`: revoke the API session.
- Legacy `POST /auth/login` and `/auth/signup`: return 410. Passwords are handled only by the provider.
- `/payments/telebirr/*` and payment-status endpoints: require a demo session and return 501 until an actual provider integration exists.
- `/stream`: authenticated fetch stream using an authorization header. Query tokens are not accepted.

Client-supplied session IDs, prices, payment outcomes and status transitions do not authorize operations. Group and booking rules stay in the API.

## Before a real pilot

SQLite requires one persistent API instance and backups. A real pilot needs a durable multi-user repository, approved rider/driver/operator permissions, verified boarding points, operations approval and incident workflows, durable rate limits, retention/deletion tooling, notifications, and reconciled provider sandbox payments. None of those capabilities are implied by the polished UI or account confirmation.
