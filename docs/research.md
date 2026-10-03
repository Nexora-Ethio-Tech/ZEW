# Technical research and choices

Research checked 2026-10-01. Choices below optimize for a first-time web builder and a route-heavy pilot; re-evaluate before production.

| Need | Choice | Why / caution |
| --- | --- | --- |
| Mobile web now, app-like later | Next.js App Router + PWA | Next.js documents manifests, installability and web push. A PWA gives one cross-platform codebase, but Android/iOS background-location limits still apply. |
| API | Node.js + TypeScript + Fastify | Fastify has TypeScript support, plugin boundaries, validation/serialization features. Keep its API separate from the frontend. |
| Spatial data | PostgreSQL + PostGIS | Spatial indexes and geography queries suit pickup points, route proximity and corridor data. It does not replace a road-routing engine. |
| Maps | MapLibre GL JS | Open-source TypeScript browser map renderer. Bring a reliable tile/style provider; do not use public demo tiles in production. |
| Matching | Deterministic rules first | Validate forward route, reachable carriageway, departure overlap, capacity and safe pickup before using any predictive/AI scoring. |
| Payments/SMS | Adapter interfaces | Provider availability, fees, KYC and regulatory suitability must be verified directly with providers before integration. Webhooks are server-side and verified. |

## Primary sources

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) documents manifests, home-screen installation, push notifications, and service-worker-related steps.
- [Next.js App Router docs](https://nextjs.org/docs/app) describe the file-based App Router used by this starter.
- [Fastify TypeScript docs](https://fastify.dev/docs/latest/Reference/TypeScript/) cover its TypeScript setup and typed request/response approach.
- [PostGIS manual](https://postgis.net/stuff/postgis-3.5.6-en.pdf) covers PostGIS spatial functionality and PostgreSQL-backed indexing/querying.
- [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/) describe the web map renderer; its Next.js worker setup notes are useful when maps are added.
- [OWASP API Security resources](https://owasp.org/API-Security/) should inform authorization, rate limiting, webhook verification and API exposure reviews.

## What needs field research, not desk research

- Route corridors, legal pickup points, road direction/median accuracy, real boarding delay, driver economics, insurance and licensing requirements.
- Payment, SMS, identity-verification and map/routing provider contracts and their Ethiopia support.
- Rider comfort, consent language, safety procedures and accessibility in the actual pilot corridor.

