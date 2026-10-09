# Implementation status

Updated 2026-10-09. Zew is a private, persistent preview with separate passenger and driver accounts and shared assigned requests. Live transport, automatic fleet assignment, real circle matching, license/vehicle verification, and payments are not connected. Planned departures now coordinate separate passenger reservations transactionally.

| Area | Current behavior |
| --- | --- |
| Landing | Responsive city illustration, API-backed fare calculator, local fonts, light/dark themes, English/Amharic/Oromo selection |
| Routes | `/rides` for circles; `/planned` for planned journeys; `/demo` redirects to `/rides` for old links |
| Circles | Thirteen staged Ethiopia journey pairs with 14 staged applicants each, no visible route picker, rider-entered positive min/max group size and fare ceiling, server-selected group on application within four-seat vehicle capacity, two-minute readiness, direction/capacity checks, Ethiopia-bounded coordinates and a locked projected quote. Driver acceptance and completion are blocked for rider and guest sessions. |
| Demand map | Sixteen approximate areas rendered as 182 pickup and 182 destination dots derived from staged application totals; no cross-session or individual location data |
| Planned rides | Server-side matching, private expiring quotes, shared departure inventory, retry-safe confirmation, rider cancellation before boarding, saved commutes, separate passenger boarding and atomic shared completion |
| Authentication | Supabase password or email-link sign-in; server verifies provider token and confirmed email before issuing an API session; operator-only SMTP setup script; no local password login or role escalation |
| Seed data | Migrations 006–009 store group places, journeys, drivers, rider profiles, projected fares, and planned trips in SQLite; no seeded password accounts or password-reset migration |
| Persistence | Authoritative SQLite catalog, durable account workspaces, private guest workspaces, driver assignments and transactional audit events; logout revokes the token while keeping account records |
| Payments | No real provider integration; initiation, webhook and status routes fail closed with 501; no phone/PIN collection in the payment screen; completion creates a simulated receipt |
| Routing | Optional OSRM call; illustrative local distance/ETA fallback, not road verification |
| Streaming | Authenticated bearer-header SSE with simulated driver ticks; no session tokens in URLs; idle timer does not keep tests alive |
| Driver/support/admin controls | `/driver` has its own inbox, active ride, history and simulated earnings. Server-owned invitations bind to confirmed provider IDs. Driver mutations verify current access and the exact assignment. Local host tools provide metrics, session revocation, maintenance and tested backup/restore. New test requests target the nominated driver through a backend setting. Support/admin production workflows remain unimplemented. |
| Offline | Production service worker caches only an offline notice; no API, auth, trip or payment caching |
| Deployment | Vercel frontend configuration, HTTPS backend-origin validation, backend Dockerfile, optional Render blueprint and deployment guide |

The old browser sign-up bypass and fake email-checked continuation have been removed. Sign-up errors are surfaced; no API session is created before confirmed provider identity. Existing local identities and associated sessions are retired by migration 005. A public key no longer attempts asynchronous database mirroring.

All validation commands must be rerun after changes. `npm run check` includes both type checks and API tests; `npm run build` builds both apps. Browser scripts cover landing/auth boundaries, circles, planned reservations, receipts, persistence, mobile layouts, and the production offline fallback. Tile requests are stubbed; circle place-search is mocked unless explicitly opted into live provider testing. Supabase email delivery and real deployment need configured provider accounts and live verification.

## API boundaries

All paths use `/api/v1`. `/health`, `/session`, and `/auth/*` have their own authentication rules. Domain operations require a session bearer header. A guest session owns only its private preview state.

- `POST /auth/session`: exchange a server-verified, email-confirmed Supabase access token for an account session. Driver access comes from a server-owned invitation, never user metadata.
- `GET /driver/dashboard`: assigned request summaries and simulated earnings; no passenger bearer tokens, workspace IDs or boarding codes.
- `POST /driver/requests/:id/action`: accept, decline, start with a boarding code, or complete the assigned request transactionally. Passenger workspaces see the same persisted state.
- `GET /auth/me`: return the stored verified account for a valid API session; guest sessions receive 401.
- `POST /auth/logout`: revoke the API session.
- Legacy `POST /auth/login` and `/auth/signup`: return 410. Passwords are handled only by the provider.
- `/payments/telebirr/*` and payment-status endpoints: require a session and return 501 until an actual provider integration exists.
- `/stream`: authenticated fetch stream using an authorization header. Query tokens are not accepted.

Client-supplied session IDs, prices, payment outcomes and status transitions do not authorize operations. Group and booking rules stay in the API.

## Before live operation

SQLite requires one persistent API instance and scheduled, off-host backups. Live operation still needs approved rider/driver/operator policies, verified boarding points, operations approval and incident workflows, account retention/deletion rules, notifications, and reconciled provider sandbox payments. None of those capabilities are implied by the polished UI or account confirmation.

## Product and code review — 2026-10-09

Assessment: this is a working private preview with enforceable driver assignment boundaries. It is not ready to carry real passengers or collect money. The refactor improves the reliability of existing flows; it does not supply the external operations described below.

### Resolved in this refactor

| Finding | Change and evidence |
| --- | --- |
| Passenger workspace mixed passenger, driver, support and admin responsibilities | Removed unreachable consoles, obsolete boarding controls and dead registration dialogs. Added dedicated planned feature components; the driver UI stays separate. |
| Reservation copy always promised one seat while requests could reserve more | Replaced group-size fields with an explicit seat count. Confirmation uses the API's total and displays the actual number of reserved seats. Browser regression covers two seats through confirmation and cancellation. |
| Driver profile contained fabricated trust signals | Removed fixed rating, completed-trip count, licence plate and amenities. Listings expose only available API data and state verification limits. |
| Search advertised capacity unavailable on the assigned vehicle | Search and dashboard clamp inventory to the active assigned driver. No dispatch target produces no bookable matches. Transactional reservation checks remain authoritative. |
| Capacity changes could prevent cancellation | Terminal records no longer undergo an active vehicle-capacity check. A regression verifies seats can be released after vehicle capacity drops. |
| Earlier account state could block a later commute | Matching separates scheduling from filtering. Shared departure slots and departure-aware duplicate checks support repeat commutes without splitting inventory by browser/request timestamp. |
| Session races could overwrite a login or clear a newer account | Central session cache guards delayed guest and unauthorized responses. Transient verification failure preserves the session. Authenticated expiration cannot silently create a guest workspace. Seven session regressions cover these cases, concurrent restoration and delayed account bodies. |
| Autocomplete was defined inside a rerendering workspace | Extracted stable, labelled keyboard-operable fields. Browser coverage verifies a partial query remains focused across dashboard polling. |
| API bootstrap owned booking business rules | Moved planned handlers, validation and domain rules to `modules/planned`; matching consumes explicit departures and catalogue fares. |
| Account UI treated verified passengers as guests | Passenger account context now comes from the verified route boundary. Root sign-in routes passengers to `/rides` and drivers to `/driver`. |
| Payment buttons implied a working provider | Replaced payment calls to action with preview information. No real payment integration is claimed. |

### Additional foundations completed

- Migrations 011–013 normalize planned departures, link private reservations, persist command receipts and throttles, add append-only simulated settlements, store expiring quotes, and aggregate request metrics.
- A driver accepts several reservations on one departure, verifies each boarding code, and starts/completes the shared trip atomically. An unresolved request blocks departure. Boarding closes new sales; cancellation is blocked after verification.
- Confirmations require a private five-minute quote. A duplicate quote or command key cannot allocate another reservation. The browser retains keys across ambiguous network failures and reloads.
- Boarding lockouts survive API restarts and new sessions. Actor throttling is scoped to the workspace; the socket-peer limiter ignores untrusted forwarding headers.
- Simulated earnings use integer minor units and append-only rows; completed-trip counts group shared reservations by departure.
- Operator commands report aggregate request/status/timing counts, revoke account API sessions, clean expired transient records, and make/verify/restore consistent SQLite snapshots. Recovery never overwrites an existing database.
- Regressions cover a v10 upgrade, cross-account privacy, quote expiry/tampering, concurrent retries, durable lockouts, whole-trip rollback on injected storage failure, and recovery of sessions, reservations, receipts and settlements.

### Remaining live-launch work

1. **Transport operations:** circles still match staged applicants and test requests target one nominated driver. Live fleet scheduling, vetted drivers/vehicles, verified boarding locations, incident handling and notifications require implementation and operating decisions. Shared planned departures do not establish real-world transport readiness.
2. **Real money:** provider integration, verified webhooks, real ledger entries, refunds, reconciliation and sandbox acceptance remain absent. The new settlement ledger is explicitly simulated.
3. **Session security:** browser bearer storage and 30-day API sessions remain. Harden session storage/lifetimes and provider revocation policy before public use. The host command revokes existing API sessions; it does not disable provider sign-in. Guest preview access remains intentional.
4. **Data operations:** one persistent SQLite instance is supported. Configure scheduled off-host encrypted backups, production retention/deletion rules and a measured recovery objective. Passenger state remains in JSON workspaces beneath normalized departures. Legacy mixed-state departures may need operator review during an upgrade.
5. **Monitoring and support:** local aggregate metrics and recovery tooling exist; external alert delivery, provider monitoring, incident assignment and operator UI remain to be connected.
6. **Product consistency:** circle and planned navigation/styles and partial translations still need a dedicated consistency/accessibility pass before broad rollout.

No provider credential change or new runtime package was introduced in this phase. The nominated test driver and existing account workspaces are preserved. Startup automatically applies migrations 011–013; take a backup before deploying them. See [operations](operations.md) for recovery and current retention behavior.

### Validation of the foundations phase

`npm run check` passed 57 backend regressions, 9 frontend session/retry regressions and six deployment configuration cases. `npm run build` passed for both applications. The passenger browser check against the production frontend verified lost-response retry, reservation totals, cancellation, saved commutes and mobile layout. The driver browser check verified a circle, a shared departure with two independent passengers, role boundaries, simulated earnings and mobile layout. The current local database was backed up with the recovery command and passed integrity checks. Live provider payment and transport checks remain outside these results.
