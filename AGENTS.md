# Working in Zew

Read `README.md`, `docs/product/brief.md`, and `docs/architecture.md` before changing behavior.

- Keep frontend and backend separate. Business rules, fares, seat reservations, and state transitions belong in the API.
- This repository currently runs a private demo. Sample drivers, schematic corridors, simulated payment, and driver controls are not real transport operations or production role-based access.
- Preserve session isolation. Never accept a client-supplied session ID, price, payment outcome, or booking status.
- Keep SQLite changes transactional and add meaningful API regression tests when changing booking or matching rules.
- Never expose payment keys, phone numbers, boarding codes, or session tokens in logs.
- Preserve labels that distinguish simulated data from real actions. Do not claim route safety, road reachability, or verification from ordered stop matching.
- Use Node 24+. Run `npm run check` and `npm run build` for behavior changes. Browser smoke checks are in `scripts/browser-smoke.mjs`.
- Update the implementation status and startup instructions when changing persistence, authentication, or dependencies.
