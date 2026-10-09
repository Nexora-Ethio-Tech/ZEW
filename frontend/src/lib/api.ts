export interface Corridor {
  id: string;
  name: string;
  stops: { id: string; name: string; area: string; latitude: number; longitude: number }[];
}
export interface Journey {
  corridorId: string;
  origin: string;
  destination: string;
  departure: string;
  seats: number;
}
export interface Trip extends Journey {
  id: string;
  driver: string;
  vehicle: string;
  fare: number;
  source: 'sample' | 'yours';
  status: 'open' | 'cancelled';
  availableSeats: number;
  differenceMinutes?: number;
  totalFare?: number;
  quoteId?: string;
  quoteExpiresAt?: string;
}
export interface Booking extends Journey {
  driverAccepted?: boolean;
  boardingVerified?: boolean;
  id: string;
  tripId: string;
  driver: string;
  vehicle: string;
  fare: number;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  code: string;
  payment: 'not_due' | 'pending_telebirr' | 'paid_telebirr' | 'simulated' | 'failed';
}
export interface Commute extends Journey {
  id: string;
  name: string;
}
export interface Dashboard {
  corridors: Corridor[];
  trips: Trip[];
  bookings: Booking[];
  commutes: Commute[];
  waitlistJoined: boolean;
  demoEarnings: {
    completedTrips: number;
    totalFare: number;
    platformFee: number;
    driverPayout: number;
  };
  events: { kind: string; entityId: string; createdAt: string }[];
}
export interface Matches {
  matches: Trip[];
  rejected: { tripId: string; reason: string }[];
}
export { userKey, getStoredUser, setAuthSession, clearAuthSession, getAuthToken } from './session';
import { retryKey } from './retry-key';
import { getAuthToken, expireSession, assertCurrentSession } from './session';

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getAuthToken();
  const retry = method !== 'GET' ? await retryKey(token, path, method, body) : undefined;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(retry ? { 'Idempotency-Key': retry.key } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Cannot reach Zew. Check your connection and try again.');
  }
  assertCurrentSession(token);
  if (response.status === 401) {
    expireSession(token);
    throw new Error('Your session expired. Sign in again to continue.');
  }
  const data = await response.json().catch(() => {
    throw new Error('Could not read the response. Try again to check this request.');
  });
  if (response.status < 500 && response.status !== 429) retry?.finish();
  assertCurrentSession(token);
  if (!response.ok) throw new Error(data.message || 'Please try again.');
  return data as T;
}
export const time = (date: string) =>
  new Date(date).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
  });
export const day = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    day: 'numeric',
    month: 'short',
  });
export function localDeparture(iso: string) {
  return new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 16);
}

export async function calculateRoadRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  return api<{
    haversineDistanceKm: number;
    roadDistanceKm: number;
    etaMinutes: number;
    detourFactor: number;
    routeSummary: string;
    isDirectCorridor: boolean;
    provider: string;
  }>('/routing/calculate', 'POST', { origin, destination });
}
