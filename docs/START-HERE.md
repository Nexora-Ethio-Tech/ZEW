# Start here — a plain-English build plan

The local demo is now implemented. Use Node 24+ and start it with `npm run setup` then `npm run dev` from the repository root. Open http://localhost:3000. Read [implementation status](implementation-status.md) to distinguish working demo features from the future pilot integrations below.

A mobile-first website can be installable as a PWA. This version includes a manifest, icons and a production offline notice. A native app later can reuse the backend and business rules, but background GPS, permissions, app-store packaging and some UI require additional work.

## What to build first

Build only a controlled-pilot flow:

1. Public landing page and pilot waitlist.
2. Rider signs in, saves commute origin/destination and time window.
3. Driver offers one planned trip with seats and a route.
4. Operations staff review/approve participants and trips.
5. The matching service proposes compatible riders; a human can approve the match for the first pilot.
6. Riders see a safe pickup point, boarding code, trip status and receipt.

Avoid live “anyone can request a ride now,” automatic payouts, continuous public location sharing, surge pricing, or multi-city expansion in v1.

## Your daily workflow

1. Pick one small ticket from `docs/product/backlog.md`.
2. Ask an AI to propose a plan and affected files before it writes code.
3. Run the app, test the happy path and one failure case.
4. Commit a small, understandable change.
5. Update the decision/log documentation when a product rule changes.

## Local commands

```bash
npm run setup
npm run dev
```

Open `http://localhost:3000`, then check `http://localhost:4000/api/v1/health`.

Docker/PostGIS is optional infrastructure for a later phase, not a prerequisite for the demo. The API loads `backend/.env` automatically if present; the frontend loads `frontend/.env.local`. Copy the examples only if you need to change defaults.
