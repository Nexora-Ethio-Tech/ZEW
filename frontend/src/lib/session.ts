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
  localStorage.setItem(key, token);
  localStorage.setItem(userKey, JSON.stringify(user));
}
export function clearAuthSession() {
  revision++;
  localStorage.removeItem(key);
  localStorage.removeItem(userKey);
}
export function expireSession(token: string) {
  // An old response must never clear a newly signed-in account.
  if (storedToken() !== token) return;
  revision++;
  localStorage.removeItem(key);
  // Preserve the account hint so polling cannot silently create a guest workspace.
}
export function assertCurrentSession(token: string) {
  if (storedToken() !== token) throw new Error('Your account changed. Please try again.');
}
export async function getAuthToken(): Promise<string> {
  const existing = storedToken();
  const account = getStoredUser();
  if (existing && account) return existing;
  if (account) throw new Error('Your session expired. Sign in again to continue.');
  throw new Error('Create an account or sign in to continue.');
}
