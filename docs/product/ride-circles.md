# Ride circles: group first, driver second

Implemented from the founder's updated direction on 2026-10-01. The main page is now a circle builder; the earlier planned-commute demo is preserved at `/planned`.

## Rider journey

1. Search for a pickup by street, landmark or city; choose a result. Or confirm a map pin, or tap **Use my location**. Browser permission is requested only on that tap. The initial locations are examples, not limits.
2. Choose any destination the same way. See fictional riders illustrating a same-direction group. These are not actual nearby people.
3. Preview your fare with each rider; add, remove, or skip them. Groups contain one to four passengers including you.
4. Submit when you are happy with your share, even if travelling alone. The request locks the group and displayed fare.
5. In Driver space, select a demo driver and accept the entire group if its seats and pickup timing fit. Start/complete the simulated journey, or cancel before departure.

## The two-minute rule

This implementation interprets two minutes as **120 seconds of estimated driving time**, not a radius and not walking distance.

- Every rider's pickup must be on the same forward demo route, with a drop-off no farther than the group's endpoint.
- The entire pickup span must be at most 120 seconds. Chaining individually short trips cannot extend that limit.
- At acceptance, add the driver's travel time to the first rider. The final pickup must still be within 120 seconds.
- The driver must arrive before each rider's ready window ends, and have enough passenger seats.
- Availability and location readings expire after 120 seconds. Stale riders leave draft groups, invalidating their previous quotes. Pending or accepted-but-not-started requests expire if a member is no longer ready. The user must explicitly start a fresh group.
- The browser displays live countdowns and refreshes server state every 15 seconds. Every mutation independently rechecks eligibility; browser controls are not the authority.

The ETA values are explicit fictional fixtures in `backend/src/modules/groups/model.ts`. They are **not** inferred from straight-line distance. Road-aware timings, medians and permitted stops need verified routing data before live operation.

## Demo fares

Each destination has a fixed total: Wollo Sefer 300 ETB, Meskel Square 360 ETB, Mexico 420 ETB. Divide that total equally among selected passengers. At Meskel Square the sequence is **360 → 180 → 120 → 90 ETB** as a group grows from one to four people.

Custom destinations use a **360 ETB illustrative total**, regardless of distance. This is a scenario for testing fare splits, not a real road-based quote. Demo riders adopt the custom destination; their ETA fixtures remain simulated. No fake rider pins or invented route geometry are drawn over the real map.

This equal split is a provisional demo rule, including for shorter drop-offs. The UI states it in the fare explanation. The backend computes both per-candidate previews and final quotes; a request carries only a quote version, never a trusted client price. A 10% fee is included in the total, not added on top. No payment is collected.

## Device location

Use `navigator.geolocation.getCurrentPosition` with a fresh reading, ten-second timeout and high accuracy. No background tracking or third-party reverse-geocoding request is made. The location is sent to the local API, scoped to the user's session. The owning session receives its pickup coordinates for the real map; other sessions cannot access them.

Device pickups work anywhere, with accuracy at most 100 metres and freshness at most two minutes. Poor accuracy, permission denial and timeout offer search/map-pin alternatives. Selecting a manual pickup removes the device reading. Session retention remains the existing local-demo policy. Legacy anchor IDs are retained for backward compatibility only; they no longer restrict eligibility.

## Real maps and place search

The homepage uses Leaflet with real OpenStreetMap tiles. Users can pan/zoom and explicitly select/confirm pickup or destination pins. Search is a submit-and-select Photon geocoder, not a fixed dropdown. The API validates provider coordinates, caches 200 searches for up to one day and limits uncached provider calls to one per second per process. No location bias or device coordinates are sent to Photon; only search text is shared. The tile provider receives the viewed area and browser request metadata. Errors are visible; offline maps are not provided.

Use `PHOTON_URL` for a production/self-hosted geocoder and `NEXT_PUBLIC_MAP_TILE_URL` plus provider attribution for another map service. Public providers have no availability guarantee. See [Photon's demo-server restrictions](https://github.com/komoot/photon#demo-server), [OSM tile usage requirements](https://operations.osmfoundation.org/policies/tiles/) and [Leaflet API](https://leafletjs.com/reference.html). No prefetching, bulk/offline tile downloads or headless tile sweeps. Browser tests intercept tile requests; search verification uses an explicit low-volume query.

Reference: [MDN geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) documents permission, secure contexts, accuracy, timeout and cache-age options. A future road-time adapter can use a service such as [OSRM Route/Table](https://project-osrm.org/docs/v5.24.0/api/) with a verified local network; none is connected now.

## API and code

Authenticated, session-owned endpoints under `/api/v1/pool`:

- `POST /bootstrap`: initialize or resume a private group.
- `GET /`: current group, fare, candidate previews, eligibility and history.
- `POST /location`, `/destination`: update pickup/destination while drafting; clear prior membership.
- `POST /place`: arbitrary validated `{target: "pickup" | "destination", place: {name, latitude, longitude}}`; resets membership and demo availability. Locked groups cannot change endpoints. History preserves the selected names.
- `POST /members`: add, remove, or skip a demo rider.
- `POST /refresh`: explicitly refresh the fictional availability window.
- `POST /request`: submit the current quote version.
- `POST /accept`: a demo driver accepts that group ID after revalidation.
- `POST /action`: cancel, start, complete, or create a new group after a terminal state.

Backend rules live in `backend/src/modules/groups/`. UI, map, avatar artwork, fare panel, types and state hook live in `frontend/src/features/pool/`. The existing SQLite session adapter stores groups transactionally. Every driver action and rider consent is still simulated within one browser's sandbox, not real multi-user authorization.

Authenticated `POST /api/v1/places/search` accepts `{query}` and returns validated `{places}`. Search failure never substitutes invented results.
