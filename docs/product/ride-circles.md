# Ride circles: group first, driver second

Implemented from the founder's updated direction on 2026-10-01. The main page is now a circle builder; the earlier planned-commute demo is preserved at `/planned`.

## Rider journey

1. Search for a pickup by street, landmark or city; choose a result. Or confirm a map pin, or tap **Use my location**. Browser permission is requested only on that tap. The initial locations are examples, not limits.
2. Choose any destination the same way. Behind the form, 13 example journey pairs have 14 fictional applicants each. The map shows illustrative pickup and destination dots generated from these application totals around approximate area centres. These are not live people or exact rider locations.
3. Choose a minimum and maximum group size, including yourself, and a maximum fare. The UI shows the server-calculated example share for every group size in that range. Tap **Apply for a shared ride**. The API selects eligible sample riders within the limits and locks the example fare in one transaction. Riders do not choose each other.
4. Review the matched group and share. If the chosen minimum is one, the private demo can create a solo request when no sample rider is eligible. Sample applicants match only when the selected pickup and destination are near the same displayed example pair; other Ethiopia journeys need a one-person minimum or the application returns no match.
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

Custom destinations use a **360 ETB illustrative total**, regardless of distance. This is a scenario for testing fare splits, not a real road-based quote. Demo riders adopt the custom destination; their ETA fixtures remain simulated. Approximate demand dots are not individual rider pins, and no invented route geometry is drawn over the real map.

This equal split is a provisional demo rule, including for shorter drop-offs. The UI states it in the fare explanation. The backend computes the final quote; an application carries the current state version and rider preferences, never a trusted client price or passenger list. A 10% fee is included in the total, not added on top. No payment is collected.

## Device location

Use `navigator.geolocation.getCurrentPosition` with a fresh reading, ten-second timeout and high accuracy. No background tracking or third-party reverse-geocoding request is made. The location is sent to the local API, scoped to the user's session. The owning session receives its pickup coordinates for the real map; other sessions cannot access them.

Device pickups work inside the coarse Ethiopia demo area, with accuracy at most 100 metres and freshness at most two minutes. Poor accuracy, permission denial and timeout offer search/map-pin alternatives. Selecting a manual pickup removes the device reading. Session retention remains the existing local-demo policy. Legacy anchor IDs are retained for backward compatibility only; they no longer restrict eligibility.

## Real maps and place search

The homepage uses Leaflet with real OpenStreetMap tiles. Users can pan/zoom and explicitly select/confirm pickup or destination pins. Search is a submit-and-select Photon geocoder, not a fixed dropdown. The API asks Photon for results within an Ethiopia bounding box, biases ranking toward Addis Ababa, and accepts only results tagged as Ethiopia and inside that box. Map pins and device locations are restricted to the same coarse box; it is not an exact national border or a road-serviceability check. The API validates provider coordinates, caches 200 searches for up to one day and limits uncached provider calls to one per second per process. Device coordinates are not sent to Photon; search text and an Addis Ababa ranking point are shared. The tile provider receives the viewed area and browser request metadata. Errors are visible; offline maps are not provided.

Use `PHOTON_URL` for a production/self-hosted geocoder and `NEXT_PUBLIC_MAP_TILE_URL` plus provider attribution for another map service. Public providers have no availability guarantee. See [Photon's demo-server restrictions](https://github.com/komoot/photon#demo-server), [OSM tile usage requirements](https://operations.osmfoundation.org/policies/tiles/) and [Leaflet API](https://leafletjs.com/reference.html). No prefetching, bulk/offline tile downloads or headless tile sweeps. Browser tests intercept tile requests; search verification uses an explicit low-volume query.

Reference: [MDN geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) documents permission, secure contexts, accuracy, timeout and cache-age options. A future road-time adapter can use a service such as [OSRM Route/Table](https://project-osrm.org/docs/v5.24.0/api/) with a verified local network; none is connected now.

## API and code

Authenticated, session-owned endpoints under `/api/v1/pool`:

- `POST /bootstrap`: initialize or resume a private group.
- `GET /`: current group, fare, candidate previews, eligibility and history.
- `POST /location`, `/destination`: update pickup/destination while drafting; clear prior membership.
- `POST /place`: arbitrary validated `{target: "pickup" | "destination", place: {name, latitude, longitude}}`; resets membership and demo availability. Locked groups cannot change endpoints. History preserves the selected names.
- `POST /demo-route`: select one of the schematic example pairs and refresh its fictional applicants atomically. The route ID does not assert actual road connectivity.
- `POST /criteria`: save any positive min/max total people and maximum acceptable fare. These are preferences, not a client quote. Actual matching respects the four-seat capacity of current demo vehicles.
- `POST /apply`: receive those preferences and select eligible sample riders within them in one transaction, then submit the request. The client cannot choose people or supply the final fare.
- `POST /refresh`: explicitly refresh the fictional availability window.
- Legacy demo routes `/members`, `/preference`, `/auto-match`, and `/request` remain for existing scripted flows; the rider UI uses `/apply` only.
- `POST /accept`: a demo driver accepts that group ID after revalidation.
- `POST /action`: cancel, start, complete, or create a new group after a terminal state.

Backend rules live in `backend/src/modules/groups/`. UI, map, avatar artwork, fare panel, types and state hook live in `frontend/src/features/pool/`. The existing SQLite session adapter stores groups transactionally. Every driver action and rider consent is still simulated within one browser's sandbox, not real multi-user authorization.

Authenticated `POST /api/v1/places/search` accepts `{query}` and returns validated `{places}`. Search failure never substitutes invented results.
