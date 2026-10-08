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
}
export interface Booking extends Journey {
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
const key = 'zew-demo-session';
export const userKey = 'zew-user-account';

export function getStoredUser(): { id: string; email: string; name: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(
  tokenStr: string,
  user: { id: string; email: string; name: string; role: string },
) {
  localStorage.setItem(key, tokenStr);
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(key);
  localStorage.removeItem(userKey);
}

let pendingSession: Promise<string> | undefined;
async function token() {
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  if (!pendingSession)
    pendingSession = fetch('/api/v1/session', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Could not start your demo. Check that the backend is running.');
        const data = await response.json();
        localStorage.setItem(key, data.token);
        return data.token as string;
      })
      .finally(() => {
        pendingSession = undefined;
      });
  return pendingSession;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${await token()}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes('demo')
        ? error.message
        : 'Cannot reach Zew. Check your connection and that the backend is running.',
    );
  }
  if (response.status === 401) {
    localStorage.removeItem(key);
    throw new Error('Your session expired. Refresh to start a new demo.');
  }
  const data = await response.json().catch(() => ({
    message: 'The API is unavailable. Check that the backend is running on port 4000.',
  }));
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

export async function getAuthToken(): Promise<string> {
  return token();
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
