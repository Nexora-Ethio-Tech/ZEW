import { randomUUID } from 'node:crypto';
import { withinEthiopiaBounds } from './ethiopia.js';
import {
  MAX_LOCATION_AGE_MS,
  MAX_MEMBERS,
  MAX_PICKUP_SECONDS,
  DEMO_APPLICANTS_PER_ROUTE,
  demoDrivers,
  demoDemandZones,
  demoRoutePlaces,
  demoRoutes,
  demoRiders,
  destinations,
  pickupZones,
  type DeviceLocation,
  type PoolRider,
  type PoolState,
  type Place,
} from './model.js';

export class GroupError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
  ) {
    super(message);
  }
}
export function requireDraft(pool: PoolState) {
  if (pool.status !== 'draft')
    throw new GroupError('Cancel or finish your current request before changing the group.');
}
export function locationIssue(pool: PoolState, now = Date.now()): string | null {
  if (pool.locationSource !== 'device') return null;
  if (!pool.location || now - pool.location.timestamp > MAX_LOCATION_AGE_MS)
    return 'Refresh your device location before requesting a ride.';
  if (pool.location.accuracy > 100)
    return 'Your location is too approximate. Try again or choose a pickup on the map.';
  return null;
}
export function riderIssue(pool: PoolState, rider: PoolRider, now = Date.now()): string | null {
  const issue = locationIssue(pool, now);
  if (issue) return issue;
  if (!rider.optedIn) return 'No longer looking for a shared ride';
  if (rider.readyUntil <= now || now - rider.locationAt > MAX_LOCATION_AGE_MS)
    return 'Availability expired';
  if (rider.direction !== 'forward') return 'Other side of the road';
  if (rider.corridorId) {
    const route = demoRoutes.find((item) => item.id === rider.corridorId);
    const pickup = pool.pickupPlace ?? pickupZones.find((zone) => zone.id === pool.zoneId);
    const destination = pool.destinationPlace ?? {
      wollosefer: demoRoutePlaces.wollosefer,
      meskel: demoRoutePlaces.meskel,
      mexico: demoRoutePlaces.mexico,
    }[pool.destination as 'wollosefer' | 'meskel' | 'mexico'];
    if (!route || !pickup || !destination ||
      distanceMeters(pickup, demoRoutePlaces[route.from]) > 650 ||
      distanceMeters(destination, demoRoutePlaces[route.to]) > 650)
      return 'This sample application is for another example journey.';
  } else if (!nearDemoCorridor(pool)) {
    return 'Sample riders are only available near the Bole demo landmarks.';
  }
  if (rider.corridorId) {
    const span = Math.max(0, rider.pickupSeconds,
      ...pool.riders.filter((r) => pool.selectedIds.includes(r.id)).map((r) => r.pickupSeconds));
    return rider.pickupSeconds < 0 || span > MAX_PICKUP_SECONDS ? 'More than 2 minutes away' : null;
  }
  const ends = groupDestinations(pool);
  const end = ends.find((d) => d.id === pool.destination)!;
  const riderEnd = ends.find((d) => d.id === rider.destination)!;
  if (riderEnd.order > end.order) return 'Drop-off is beyond your route';
  // Check total directed span, preventing a chain of individually short pickups exceeding the cap.
  const span = Math.max(
    0,
    rider.pickupSeconds,
    ...pool.riders.filter((r) => pool.selectedIds.includes(r.id)).map((r) => r.pickupSeconds),
  );
  if (rider.pickupSeconds < 0 || span > MAX_PICKUP_SECONDS) return 'More than 2 minutes away';
  return null;
}
export function fareQuote(pool: PoolState, count = 1 + pool.selectedIds.length) {
  const total = groupDestinations(pool).find((d) => d.id === pool.destination)!.fare;
  // Integer santim allocation. Any rounding remainder goes to the lead rider.
  const otherShare = Math.floor((total * 100) / count);
  const ownShare = total * 100 - otherShare * (count - 1);
  return {
    total,
    count,
    yourFare: ownShare / 100,
    otherFare: otherShare / 100,
    savings: total - ownShare / 100,
    fee: total * 0.1,
    driverPayout: total * 0.9,
    split: 'equal' as const,
  };
}
export function syncExpiry(pool: PoolState, now = Date.now()) {
  if (pool.status === 'draft') {
    const valid = pool.selectedIds.filter((id) => {
      const rider = pool.riders.find((r) => r.id === id);
      return rider && !riderIssue(pool, rider, now);
    });
    if (valid.length !== pool.selectedIds.length) {
      pool.selectedIds = valid;
      pool.version++;
    }
  } else if (
    ['requested', 'accepted'].includes(pool.status) &&
    ((pool.requestedUntil ?? 0) <= now ||
      locationIssue(pool, now) ||
      pool.selectedIds.some((id) =>
        riderIssue(
          pool,
          pool.riders.find((r) => r.id === id)!,
          now,
        ),
      ))
  ) {
    pool.status = 'expired';
    pool.version++;
  }
}
export function addRider(pool: PoolState, id: string, now = Date.now()) {
  requireDraft(pool);
  if (pool.selectedIds.includes(id)) throw new GroupError('This rider is already in your group.');
  if (pool.selectedIds.length >= MAX_MEMBERS - 1)
    throw new GroupError('Your group has all four seats.');
  const rider = pool.riders.find((r) => r.id === id);
  if (!rider) throw new GroupError('Rider not found.', 404);
  const issue = riderIssue(pool, rider, now);
  if (issue) throw new GroupError(issue);
  pool.selectedIds.push(id);
  pool.skippedIds = pool.skippedIds.filter((skipped) => skipped !== id);
  pool.version++;
}
export function setTargetPreference(pool: PoolState, targetSeats: number, now = Date.now()) {
  requireDraft(pool);
  if (!Number.isInteger(targetSeats) || targetSeats < 1 || targetSeats > MAX_MEMBERS) {
    throw new GroupError('Target seats must be between 1 and 4.');
  }
  const preview = preferencePreview(pool, targetSeats, now);
  if (preview.issue) throw new GroupError(preview.issue);
  pool.targetSeats = targetSeats;
  pool.selectedIds = preview.selectedIds;
  pool.version++;
}
function preferencePreview(pool: PoolState, seats: number, now: number) {
  const candidate = { ...pool, selectedIds: [] as string[] };
  for (const rider of pool.riders) {
    if (candidate.selectedIds.length >= seats - 1) break;
    if (pool.skippedIds.includes(rider.id) || riderIssue(candidate, rider, now)) continue;
    const next = { ...candidate, selectedIds: [...candidate.selectedIds, rider.id] };
    if (demoDrivers.some((driver) => !driverIssue(next, driver.id, now)))
      candidate.selectedIds.push(rider.id);
  }
  return {
    seats,
    yourFare: fareQuote(pool, seats).yourFare,
    selectedIds: candidate.selectedIds,
    issue:
      locationIssue(pool, now) ||
      (candidate.selectedIds.length !== seats - 1
        ? 'Not enough ready demo riders for this example journey. Refresh availability or choose another route.'
        : null),
  };
}
function nearDemoCorridor(pool: PoolState) {
  const demoPickup = pool.pickupPlace ?? pickupZones.find((zone) => zone.id === pool.zoneId);
  const destinationAnchor = pool.destinationPlace
    ? [
        { latitude: 8.9905, longitude: 38.7713 },
        { latitude: 9.0108, longitude: 38.7615 },
        { latitude: 9.0104, longitude: 38.7453 },
      ].some((stop) => distanceMeters(pool.destinationPlace!, stop) <= 1000)
    : true;
  return Boolean(
    demoPickup &&
    pickupZones.some((zone) => distanceMeters(demoPickup, zone) <= 1000) &&
    destinationAnchor,
  );
}
export function driverIssue(pool: PoolState, id: string, now = Date.now()) {
  const driver = demoDrivers.find((d) => d.id === id);
  if (!driver) return 'Driver not found';
  if (driver.seats < 1 + pool.selectedIds.length) return 'Not enough passenger seats';
  const span = Math.max(
    0,
    ...pool.riders.filter((r) => pool.selectedIds.includes(r.id)).map((r) => r.pickupSeconds),
  );
  if (driver.etaSeconds + span > MAX_PICKUP_SECONDS) return 'Last pickup would exceed 2 minutes';
  if (
    pool.riders.some(
      (r) =>
        pool.selectedIds.includes(r.id) &&
        now + (driver.etaSeconds + r.pickupSeconds) * 1000 > r.readyUntil,
    )
  )
    return 'Rider availability ends before pickup';
  return null;
}
export function requestGroup(pool: PoolState, version: number, now = Date.now()) {
  syncExpiry(pool, now);
  requireDraft(pool);
  if (pool.version !== version)
    throw new GroupError('Your group or fare changed. Review the updated total and try again.');
  const issue = locationIssue(pool, now);
  if (issue) throw new GroupError(issue);
  for (const id of pool.selectedIds) {
    const reason = riderIssue(
      pool,
      pool.riders.find((r) => r.id === id)!,
      now,
    );
    if (reason) throw new GroupError(reason);
  }
  if (!demoDrivers.some((driver) => !driverIssue(pool, driver.id, now))) {
    throw new GroupError(
      'No demo driver can reach everyone before their availability ends. Refresh nearby riders or choose a smaller group.',
    );
  }
  pool.status = 'requested';
  pool.lockedFare = fareQuote(pool).yourFare;
  pool.requestedUntil = Math.min(
    now + 120000,
    ...pool.riders.filter((r) => pool.selectedIds.includes(r.id)).map((r) => r.readyUntil),
  );
  pool.version++;
}
export function applyForGroup(pool: PoolState, version: number, now = Date.now()) {
  syncExpiry(pool, now);
  requireDraft(pool);
  if (pool.version !== version)
    throw new GroupError('Your journey changed. Review it and apply again.');
  const issue = locationIssue(pool, now);
  if (issue) throw new GroupError(issue);

  // Match only fictional applicants seeded for the selected example journey.
  const minSeats = pool.minSeats ?? 1;
  const maxSeats = pool.maxSeats ?? MAX_MEMBERS;
  const maxFare = pool.maxFare ?? fareQuote(pool, 1).yourFare;
  for (let seats = Math.min(maxSeats, MAX_MEMBERS); seats >= minSeats; seats--) {
    const preview = preferencePreview(pool, seats, now);
    if (preview.issue || preview.yourFare > maxFare) continue;
    pool.selectedIds = preview.selectedIds;
    pool.targetSeats = seats;
    requestGroup(pool, version, now);
    return;
  }
  throw new GroupError('No demo group meets your people and fare limits right now. Adjust them or refresh demo availability.');
}
export function setGroupCriteria(
  pool: PoolState,
  input: { minSeats: number; maxSeats: number; maxFare: number },
) {
  requireDraft(pool);
  if (
    !Number.isSafeInteger(input.minSeats) ||
    !Number.isSafeInteger(input.maxSeats) ||
    input.minSeats < 1 ||
    input.maxSeats < 1 ||
    input.minSeats > input.maxSeats ||
    !Number.isFinite(input.maxFare) ||
    input.maxFare <= 0
  ) throw new GroupError('Choose a valid group size and fare limit.', 400);
  pool.minSeats = input.minSeats;
  pool.maxSeats = input.maxSeats;
  pool.maxFare = input.maxFare;
  pool.selectedIds = [];
  pool.version++;
}
export function acceptGroup(pool: PoolState, driverId: string, now = Date.now()) {
  syncExpiry(pool, now);
  if (pool.status !== 'requested') throw new GroupError('This group request is no longer open.');
  const issue = driverIssue(pool, driverId, now);
  if (issue) throw new GroupError(issue);
  pool.driverId = driverId;
  pool.status = 'accepted';
  pool.version++;
}
export function setDeviceLocation(pool: PoolState, location: DeviceLocation, now = Date.now()) {
  requireDraft(pool);
  if (!withinEthiopiaBounds(location))
    throw new GroupError('Choose a location in Ethiopia for this demo.', 400);
  if (location.timestamp > now + 5000 || location.timestamp < now - MAX_LOCATION_AGE_MS)
    throw new GroupError('That location is stale. Please try again.', 400);
  const nearest = pickupZones
    .map((zone) => ({ zone, distance: distanceMeters(location, zone) }))
    .sort((a, b) => a.distance - b.distance)[0];
  pool.location = location;
  pool.locationSource = 'device';
  pool.pickupPlace = {
    name: 'Your device location',
    latitude: location.latitude,
    longitude: location.longitude,
  };
  pool.zoneId = nearest.distance <= 250 && location.accuracy <= 100 ? nearest.zone.id : null;
  pool.selectedIds = [];
  pool.skippedIds = [];
  pool.version++;
}
function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function refreshDemo(pool: PoolState, now = Date.now()) {
  requireDraft(pool);
  pool.riders = demoRiders(now);
  if (pool.destinationPlace)
    pool.riders.forEach((r) => {
      r.destination = 'custom';
    });
  pool.skippedIds = [];
  pool.version++;
}
export function newGroup(pool: PoolState, now = Date.now()) {
  if (!['completed', 'cancelled', 'expired'].includes(pool.status))
    throw new GroupError('Finish or cancel your current group first.');
  pool.id = randomUUID();
  pool.selectedIds = [];
  pool.skippedIds = [];
  pool.riders = demoRiders(now);
  if (pool.destinationPlace)
    pool.riders.forEach((r) => {
      r.destination = 'custom';
    });
  pool.status = 'draft';
  pool.targetSeats = 1;
  pool.requestedUntil = undefined;
  pool.lockedFare = undefined;
  pool.driverId = undefined;
  pool.version++;
}
export function groupDestinations(pool: PoolState) {
  return pool.destinationPlace
    ? [...destinations, { id: 'custom', name: pool.destinationPlace.name, fare: 360, order: 4 }]
    : [...destinations];
}
export function setPlace(pool: PoolState, target: 'pickup' | 'destination', place: Place) {
  requireDraft(pool);
  if (!withinEthiopiaBounds(place))
    throw new GroupError('Choose a place in Ethiopia for this demo.', 400);
  if (target === 'pickup') {
    pool.pickupPlace = place;
    pool.locationSource = 'place';
    pool.location = undefined;
    pool.zoneId = null;
  } else {
    pool.destinationPlace = place;
    pool.destination = 'custom';
  }
  pool.selectedIds = [];
  refreshDemo(pool);
}
export function setDemoRoute(pool: PoolState, routeId: string) {
  requireDraft(pool);
  const route = demoRoutes.find((item) => item.id === routeId);
  if (!route) throw new GroupError('Example journey not found.', 404);
  pool.pickupPlace = demoRoutePlaces[route.from];
  pool.destinationPlace = demoRoutePlaces[route.to];
  pool.destination = 'custom';
  pool.locationSource = 'place';
  pool.location = undefined;
  pool.zoneId = null;
  pool.selectedIds = [];
  refreshDemo(pool);
}
export function autoMatchGroup(
  pool: PoolState,
  options: { minSeats?: number; maxSeats?: number; maxFare?: number; targetSeats?: number } = {},
  now = Date.now(),
) {
  requireDraft(pool);
  const minSeats = Math.max(1, Math.min(MAX_MEMBERS, options.minSeats ?? 2));
  const maxSeats = Math.max(minSeats, Math.min(MAX_MEMBERS, options.maxSeats ?? 4));
  const maxFareBudget = options.maxFare && options.maxFare > 0 ? options.maxFare : 360;

  const issue = locationIssue(pool, now);
  if (issue) throw new GroupError(issue);

  const availableRiders = pool.riders.filter(
    (r) => !pool.skippedIds.includes(r.id) && !riderIssue(pool, r, now),
  );

  let bestGroupRiders: PoolRider[] | null = null;
  let bestGroupSize = 1;

  for (let seats = maxSeats; seats >= minSeats; seats--) {
    const candidateRiders = availableRiders
      .slice()
      .sort((a, b) => a.pickupSeconds - b.pickupSeconds)
      .slice(0, seats - 1);

    const groupCount = 1 + candidateRiders.length;
    if (groupCount < minSeats) continue;

    const candidatePool: PoolState = { ...pool, selectedIds: candidateRiders.map((r) => r.id) };
    const quote = fareQuote(candidatePool, groupCount);

    if (quote.yourFare <= maxFareBudget) {
      const matchingDriver = demoDrivers.find((d) => !driverIssue(candidatePool, d.id, now));
      if (matchingDriver) {
        bestGroupRiders = candidateRiders;
        bestGroupSize = groupCount;
        break;
      }
    }
  }

  if (!bestGroupRiders && minSeats > 1) {
    const fallbackRiders = availableRiders
      .slice()
      .sort((a, b) => a.pickupSeconds - b.pickupSeconds)
      .slice(0, maxSeats - 1);
    const candidatePool: PoolState = { ...pool, selectedIds: fallbackRiders.map((r) => r.id) };
    const matchingDriver = demoDrivers.find((d) => !driverIssue(candidatePool, d.id, now));

    if (matchingDriver && 1 + fallbackRiders.length >= minSeats) {
      bestGroupRiders = fallbackRiders;
      bestGroupSize = 1 + fallbackRiders.length;
    }
  }

  if (!bestGroupRiders) {
    throw new GroupError(
      `No automated ride group could be formed matching min ${minSeats} passengers and max fare ${maxFareBudget} ETB. Try adjusting your preferences or refreshing availability.`,
    );
  }

  pool.selectedIds = bestGroupRiders.map((r) => r.id);
  pool.targetSeats = bestGroupSize;
  pool.minSeats = minSeats;
  pool.maxSeats = maxSeats;
  pool.maxFare = maxFareBudget;
  pool.version++;
  return poolView(pool, now);
}

export function computeGuidance(pool: PoolState, mapPickupName: string) {
  const members = pool.riders.filter((r) => pool.selectedIds.includes(r.id));
  if (members.length === 0) {
    return {
      meetingPoint: mapPickupName,
      instruction: 'Stand at your designated pickup spot. Your driver will stop directly at your pin.',
      walkingMeters: 0,
      crossStreet: false,
      estimatedGatherMinutes: 1,
    };
  }

  const primarySpot = members[0].pickup;
  const needCross = members.some(
    (m) => m.pickup.toLowerCase().includes('opposite') || m.pickup.toLowerCase().includes('across'),
  );
  const names = members.map((m) => m.name.split(' ')[0]).join(' & ');

  return {
    meetingPoint: `Shared Hub: ${primarySpot}`,
    instruction: needCross
      ? `Walk ~30m across the zebra crossing to meet ${names} at ${primarySpot}.`
      : `Walk ~20m along the sidewalk to gather with ${names} at ${primarySpot}.`,
    walkingMeters: needCross ? 35 : 20,
    crossStreet: needCross,
    estimatedGatherMinutes: 2,
  };
}

export function computeDriverItinerary(pool: PoolState, mapPickupName: string) {
  const members = pool.riders.filter((r) => pool.selectedIds.includes(r.id));
  const driver = demoDrivers.find((d) => d.id === pool.driverId);
  const quote = fareQuote(pool);
  const destName = groupDestinations(pool).find((d) => d.id === pool.destination)?.name ?? 'Destination';

  return {
    groupCode: `ZEW-GRP-${pool.id.slice(0, 6).toUpperCase()}`,
    driverName: driver?.name ?? 'Assigned Driver',
    car: driver?.car ?? 'Taxi',
    plate: driver?.plate ?? 'DEMO',
    driverPhone: driver?.phone ?? '+251 91 188 9012 (Simulated)',
    totalSeats: 1 + members.length,
    payoutPerSeat: quote.otherFare,
    totalDriverPayout: quote.driverPayout,
    passengers: [
      {
        id: 'you',
        name: 'You (Group Host)',
        phone: '+251 91 100 0000 (Simulated)',
        pickup: mapPickupName,
        destination: destName,
        fare: quote.yourFare,
        status: 'confirmed' as const,
      },
      ...members.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone ?? '+251 91 234 5678 (Simulated)',
        pickup: r.pickup,
        destination: groupDestinations(pool).find((d) => d.id === r.destination)?.name ?? destName,
        fare: quote.otherFare,
        status: 'confirmed' as const,
      })),
    ],
  };
}

export function poolView(pool: PoolState, now = Date.now()) {
  // Map coordinates are returned only to the owning authenticated session, never other riders.
  const { location, ...publicPool } = pool;
  const mapPickup =
    pool.pickupPlace ??
    (pool.locationSource === 'device' && location
      ? { name: 'Your device location', latitude: location.latitude, longitude: location.longitude }
      : (pickupZones.find((z) => z.id === pool.zoneId) ?? pickupZones[0]));
  return {
    ...publicPool,
    mode: 'demo' as const,
    serverNow: now,
    maxPickupSeconds: MAX_PICKUP_SECONDS,
    location: location ? { accuracy: location.accuracy, timestamp: location.timestamp } : undefined,
    pickupName: mapPickup.name,
    mapPickup,
    mapDestination: pool.destinationPlace ?? {
      name: destinations.find((d) => d.id === pool.destination)!.name,
      ...{
        wollosefer: { latitude: 8.9905, longitude: 38.7713 },
        meskel: { latitude: 9.0108, longitude: 38.7615 },
        mexico: { latitude: 9.0104, longitude: 38.7453 },
      }[pool.destination]!,
    },
    locationIssue: locationIssue(pool, now),
    targetSeats: pool.targetSeats ?? 1,
    minSeats: pool.minSeats ?? 1,
    maxSeats: pool.maxSeats ?? 4,
    maxFare: pool.maxFare ?? fareQuote(pool, 1).yourFare,
    fareOptions: Array.from({ length: MAX_MEMBERS }, (_, i) => {
      const { selectedIds: _selected, ...preview } = preferencePreview(pool, i + 1, now);
      return preview;
    }),
    requestIssue:
      locationIssue(pool, now) ||
      (!demoDrivers.some((driver) => !driverIssue(pool, driver.id, now))
        ? 'No demo driver can reach this circle in time. Refresh availability or remove a rider.'
        : null),
    driverEarnings: demoDrivers.map((driver) => {
      const receipts = pool.history.filter(
        (ride) => ride.driverId === driver.id && ride.driverPayout !== undefined,
      );
      return {
        driverId: driver.id,
        completedTrips: receipts.length,
        payout: Math.round(receipts.reduce((sum, ride) => sum + ride.driverPayout!, 0) * 100) / 100,
      };
    }),
    destinations: groupDestinations(pool),
    pickupZones: pickupZones.map(({ id, name }) => ({ id, name })),
    demandZones: demoDemandZones,
    sampleRoutes: demoRoutes.map((route) => ({
      id: route.id,
      pickup: demoRoutePlaces[route.from].name,
      destination: demoRoutePlaces[route.to].name,
      sampleApplicants: DEMO_APPLICANTS_PER_ROUTE,
    })),
    quote: fareQuote(pool),
    guidance: computeGuidance(pool, mapPickup.name),
    driverItinerary: computeDriverItinerary(pool, mapPickup.name),
    riders: pool.riders.map((r) => ({
      ...r,
      issue: riderIssue(pool, r, now),
      selected: pool.selectedIds.includes(r.id),
      yourFareIfAdded:
        pool.status === 'draft' &&
        !pool.selectedIds.includes(r.id) &&
        pool.selectedIds.length < MAX_MEMBERS - 1 &&
        !riderIssue(pool, r, now)
          ? fareQuote({ ...pool, selectedIds: [...pool.selectedIds, r.id] }).yourFare
          : null,
    })),
    drivers: demoDrivers.map((d) => ({ ...d, issue: driverIssue(pool, d.id, now) })),
  };
}
