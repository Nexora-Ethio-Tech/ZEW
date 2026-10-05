# Implementation status

## Latest: ride circles

Updated: arbitrary pickup/destination selection via real Photon place search, confirmed map pins and device GPS. Leaflet displays real OpenStreetMap streets on the homepage. Fixed stops no longer constrain the main ride flow. No actual road route, live riders or live pickup ETAs are claimed; the group engine still runs explicitly simulated fixtures. Custom route totals are illustrative 360 ETB. Provider configuration and usage limits are in README.

The main experience now builds a group before requesting a driver. It includes seeded demo people/history, optional browser geolocation, per-candidate fare previews, add/remove/skip, two-minute readiness and pickup limits, quote locking, driver group acceptance and completion. See [ride-circle rules](product/ride-circles.md) for exact timing, pricing, privacy and demo limits. The earlier planned-commute experience below is preserved at `/planned`.

Implemented 2026-10-01 as a private, persistent demo. Every browser session is isolated. Driver space simulates the other side of that session's bookings; it is **not** production driver or operator authorization.

## Working today

| Area | Implementation |
| --- | --- |
| Rider | Corridor/stop/time/seat form, ranked sample matches, reservation, boarding code, cancellation, history |
| Driver | Create/cancel personal demo offers, validate boarding code, complete a simulated journey, payout total |
| Payments | Telebirr Merchant USSD payment initiation (`/payments/telebirr/initiate`), HMAC-SHA256 signature verification, and webhook callbacks |
| Routing Engine | OSRM road distance matrix calculations with localized Addis Ababa urban road detour factors and fallback matrix engine |
| Live Streaming | Server-Sent Events (SSE) stream (`/api/v1/stream`) for live driver radar tick updates and real-time payment status broadcasts |
| Support Desk | Phone dispatch desk (book on behalf of caller, generate code), live driver radar & fleet monitor |
| Administrator | System KPIs, revenue tracking, driver verification/approvals, and live API audit stream |
| Commutes | Save, reuse, remove; maximum 10 per session |
| Authentication | Supabase Auth (Email Sign Up with email verification, Password Sign In, Sign Out / Logout from Account menu, Instant Demo Login), role-based session state |
| Persistence | Node 24 built-in SQLite + `migrations/` runner (`npm run migrate`), Supabase database integration support, session-token hashes, 30-day sessions, transactional state changes and event log |
| Web app | Responsive layout, install manifest and PNG icons, production offline notice |
| Checks | API tests for matching, transitions, duplicate races, isolation, validation, Telebirr webhooks, OSRM routing, SSE streaming, and restart persistence |

## API

All paths use `/api/v1`. `POST /session` creates a private demo and returns a bearer token. Other than `/health`, all endpoints below require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /dashboard | Session-owned trips, bookings, commutes and activity |
| POST | /matches | Check a journey against sample trips |
| POST | /bookings | Revalidate and reserve seats atomically |
| POST | /bookings/:id/action | `board` with code, `complete`, or `cancel` |
| POST | /payments/telebirr/initiate | Initiate Telebirr Merchant USSD payment push |
| POST | /payments/telebirr/webhook | Public webhook callback with HMAC signature verification |
| GET | /payments/:outTradeNo/status | Query verified payment status |
| POST | /routing/calculate | Authoritative OSRM road distance, ETA & detour calculation |
| GET | /stream | Server-Sent Events (SSE) stream for live driver ticks and payment updates |
| POST / DELETE | /commutes, /commutes/:id | Save/remove a commute |
| POST | /trips | Save an isolated driver offer |
| POST | /trips/:id/cancel | Cancel your own offer |
| POST | /waitlist | Persist a consented demo registration |

Journey input is `{ corridorId, origin, destination, departure, seats }`. Departure uses ISO 8601 with an explicit offset. The UI labels all times as Addis time (UTC+3). Fare is computed server-side; the client cannot supply it.

## Rules and limits

- The legacy `/planned` flow checks ordered stops and retains an illustrative map. The homepage displays real streets and selected coordinates, but demo matching does not verify actual carriageway, traffic or legal pickup reachability. There are no navigation/routing requests yet.
- Requests must be within the next 30 days. Sample departures match within ±30 minutes. Reversed and outside-route requests are rejected.
- Each booking reserves seats for the entire trip. Completed bookings continue to consume that trip's seats; cancelled bookings release them. Segment-level capacity is future work.
- Booking transitions: `confirmed → in_progress → completed`, or `confirmed → cancelled`. A boarding code is required before starting. Completion records a simulated payment only.
- Own driver offers cannot be booked. Offers remain private to your demo. Real rider/driver interaction and operations approval require an authenticated data model.
- SQLite session documents are a demo simplification for one small local server. Sessions expire after 30 days; expired records are not automatically purged yet.
- Rate limits are in-process and IP-based. Production needs durable limits, separate session-creation limits, retention/deletion tools, and real identity/authorization.
- The service worker caches only the offline page. It never stores API responses or queues ride/payment actions while offline.

## Next implementation milestones

1. Connect phone verification; replace demo sessions with rider/driver/operator permissions and verification workflows.
2. Add a PostgreSQL/PostGIS repository with migrations, approved boarding points and a real routing provider. Validate local road data before enabling automated matches.
3. Add operations approval, driver acceptance/expiry, notifications, incident handling, and a pilot dashboard.
4. Integrate a selected payment provider in sandbox, verify webhooks, reconcile the ledger, then evaluate real transactions.

These milestones need provider accounts and product decisions; none are represented as connected by the current UI.
