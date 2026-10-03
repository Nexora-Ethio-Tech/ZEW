# ADR 002: A persistent private demo before provider integration

Status: accepted for the local demo, 2026-10-01.

Use Node 24's built-in SQLite through `backend/src/shared/store.ts`. This lets a beginner run the full product flow without Docker or provider credentials. Transactions atomically commit bookings and activity events; random bearer tokens identify isolated sandboxes.

This does not replace the planned PostgreSQL/PostGIS architecture. Ordered stop matching is only a demo of direction and containment rules, not a road-aware geospatial engine. The SQLite session-document adapter must be replaced with normalized tables and authenticated roles before multi-user pilots.

The API exposes simulator controls intentionally. They never contact drivers, collect money, or approve actual people. The UI labels those actions and sample data.

Reference: [Node.js SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html). The implementation uses the already-installed Node runtime and adds no database dependency.
