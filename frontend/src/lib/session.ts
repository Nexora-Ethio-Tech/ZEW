// Storage is a client cache, never an authority for access or roles.
export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'rider' | 'driver';
}
const key = 'zew-demo-session';
export const userKey = 'zew-user-account';
let revision = 0;
let pendingSession: Promise<string> | undefined;
export const sessionRevision = () => revision;
export const storedToken = () => localStorage.getItem(key);

export function getStoredUser(): Account | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem(userKey) ?? 'null');
    return user &&
      typeof user.id === 'string' &&
      typeof user.email === 'string' &&
      typeof user.name === 'string' &&
      ['rider', 'driver'].includes(user.role)
      ? user
      : null;
  } catch {
    return null;
  }
}
export function setAuthSession(token: string, user: Account) {
  revision++;
  pendingSession = undefined;
  localStorage.setItem(key, token);
  localStorage.setItem(userKey, JSON.stringify(user));
}
export function clearAuthSession() {
  revision++;
  pendingSession = undefined;
  localStorage.removeItem(key);
  localStorage.removeItem(userKey);
}
export function expireSession(token: string) {
  // An old response must never clear a newly signed-in account.
  if (storedToken() !== token) return;
  revision++;
  pendingSession = undefined;
  localStorage.removeItem(key);
  // Preserve the account hint so polling cannot silently create a guest workspace.
}
export function assertCurrentSession(token: string) {
  if (storedToken() !== token) throw new Error('Your account changed. Please try again.');
}
export async function getAuthToken(): Promise<string> {
  const existing = storedToken();
  if (existing) return existing;
  if (getStoredUser()) throw new Error('Your session expired. Sign in again to continue.');
  if (!pendingSession) {
    const started = revision;
    const request = fetch('/api/v1/session', { method: 'POST', signal: AbortSignal.timeout(15000) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not open your workspace. Please try again.');
        const data = await response.json();
        if (started !== revision || storedToken())
          throw new Error('Your account changed. Please try again.');
        if (typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token))
          throw new Error('Could not open your workspace. Please try again.');
        localStorage.setItem(key, data.token);
        return data.token as string;
      })
      .finally(() => {
        if (pendingSession === request) pendingSession = undefined;
      });
    pendingSession = request;
  }
  return pendingSession;
}
