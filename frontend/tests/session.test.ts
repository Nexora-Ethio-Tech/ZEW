import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/api';
import {
  clearAuthSession,
  setAuthSession,
  getAuthToken,
  storedToken,
  getStoredUser,
} from '../src/lib/session';
import { restoreAccount } from '../src/lib/auth';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  },
  configurable: true,
});
const originalFetch = globalThis.fetch;
const account = {
  id: 'passenger',
  email: 'passenger@example.com',
  name: 'Passenger',
  role: 'rider' as const,
};
const oldToken = 'a'.repeat(64),
  newToken = 'b'.repeat(64);
afterEach(() => {
  clearAuthSession();
  globalThis.fetch = originalFetch;
});
function deferredResponse() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test('signed-out requests cannot create guest sessions, including with a legacy cached token', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ token: oldToken });
  };
  await assert.rejects(getAuthToken(), /Create an account or sign in/);
  localStorage.setItem('zew-demo-session', oldToken);
  await assert.rejects(getAuthToken(), /Create an account or sign in/);
  assert.equal(requests, 0);
});
test('a delayed unauthorized response cannot clear a newer account session', async () => {
  setAuthSession(oldToken, account);
  const response = deferredResponse();
  globalThis.fetch = async () => response.promise;
  const request = api('/dashboard');
  await Promise.resolve();
  setAuthSession(newToken, account);
  response.resolve(Response.json({ message: 'Expired' }, { status: 401 }));
  await assert.rejects(request, /account changed/);
  assert.equal(storedToken(), newToken);
});
test('temporary account verification failures preserve the existing session', async () => {
  setAuthSession(oldToken, account);
  globalThis.fetch = async () => Response.json({ message: 'Unavailable' }, { status: 503 });
  await assert.rejects(restoreAccount(), /verify your account/);
  assert.equal(storedToken(), oldToken);
  assert.equal(getStoredUser()?.id, account.id);
});
test('expired authenticated polling does not create a replacement guest workspace', async () => {
  setAuthSession(oldToken, account);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ message: 'Expired' }, { status: 401 });
  };
  await assert.rejects(api('/dashboard'), /session expired/);
  await assert.rejects(api('/dashboard'), /session expired/);
  assert.equal(requests, 1);
  assert.equal(storedToken(), null);
  assert.equal(getStoredUser()?.id, account.id);
});
test('concurrent account restoration shares one verification request', async () => {
  setAuthSession(oldToken, account);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ user: account });
  };
  const users = await Promise.all([restoreAccount(), restoreAccount()]);
  assert.deepEqual(users, [account, account]);
  assert.equal(requests, 1);
});
test('a delayed account response body cannot restore a previously signed-out account', async () => {
  setAuthSession(oldToken, account);
  let finish!: (user: object) => void;
  const body = new Promise((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = async () => ({ ok: true, status: 200, json: () => body }) as Response;
  const restore = restoreAccount();
  await Promise.resolve();
  setAuthSession(newToken, { ...account, id: 'another-passenger' });
  finish({ user: account });
  await assert.rejects(restore, /account changed/);
  assert.equal(storedToken(), newToken);
  assert.equal(getStoredUser()?.id, 'another-passenger');
});

test('an ambiguous mutation response reuses its key and definitive success clears it', async () => {
  setAuthSession(oldToken, account);
  const keys: string[] = [];
  globalThis.fetch = async (_url, options) => {
    keys.push(new Headers(options?.headers).get('Idempotency-Key')!);
    if (keys.length === 1) throw new Error('connection lost after commit');
    return Response.json({ ok: true });
  };
  await assert.rejects(api('/commutes', 'POST', { name: 'Morning' }), /Cannot reach/);
  await api('/commutes', 'POST', { name: 'Morning' });
  await api('/commutes', 'POST', { name: 'Morning' });
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});
test('retry keys cannot follow a mutation into another account', async () => {
  setAuthSession(oldToken, account);
  const keys: string[] = [];
  globalThis.fetch = async (_url, options) => {
    keys.push(new Headers(options?.headers).get('Idempotency-Key')!);
    return Response.json({ message: 'Unavailable' }, { status: 503 });
  };
  await assert.rejects(api('/commutes', 'POST', { name: 'Evening' }));
  setAuthSession(newToken, { ...account, id: 'other' });
  await assert.rejects(api('/commutes', 'POST', { name: 'Evening' }));
  assert.notEqual(keys[0], keys[1]);
});
