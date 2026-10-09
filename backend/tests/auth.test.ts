import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { Store } from '../src/shared/store.js';
import type { IdentityVerifier } from '../src/modules/auth/service.js';

const verifier: IdentityVerifier = async (token) => {
  if (token === 'invalid') return null;
  return {
    id: 'provider-user',
    email: 'rider@example.test',
    name: 'Rider',
    emailConfirmed: token === 'confirmed',
  };
};

test('signup and local password login cannot create an authenticated session', async (t) => {
  const app = buildApp({ verifyIdentity: verifier });
  t.after(() => app.close());
  for (const action of ['signup', 'login']) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/${action}`,
      payload: { email: 'rider@zew.et', password: 'word123pass', role: 'operator' },
    });
    assert.equal(res.statusCode, 410);
    assert.equal('token' in res.json(), false);
  }
});

test('API identity exchange rejects missing, invalid and unconfirmed provider tokens', async (t) => {
  const app = buildApp({ verifyIdentity: verifier });
  t.after(() => app.close());
  for (const [token, code] of [
    ['', 401],
    ['invalid', 401],
    ['unconfirmed', 403],
  ] as const) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload: { emailConfirmed: true, role: 'admin' },
    });
    assert.equal(response.statusCode, code);
    assert.equal('token' in response.json(), false);
  }
});

test('confirmed identity uses server-owned profile and rider permissions; logout revokes API access', async (t) => {
  const app = buildApp({ verifyIdentity: verifier });
  t.after(() => app.close());
  const exchanged = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer confirmed' },
    payload: { id: 'forged-user', email: 'other@example.test', role: 'operator' },
  });
  assert.equal(exchanged.statusCode, 201);
  const { token, user } = exchanged.json();
  assert.deepEqual(user, {
    id: 'provider-user',
    email: 'rider@example.test',
    name: 'Rider',
    role: 'rider',
  });
  const headers = { authorization: `Bearer ${token}` };
  assert.deepEqual((await app.inject({ url: '/api/v1/auth/me', headers })).json().user, user);
  assert.equal((await app.inject({ url: '/api/v1/dashboard', headers })).statusCode, 200);
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })).statusCode,
    204,
  );
  assert.equal((await app.inject({ url: '/api/v1/auth/me', headers })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/v1/dashboard', headers })).statusCode, 401);
});

test('guest creation is disabled and previously issued guest tokens cannot access domain routes', async (t) => {
  const store = new Store(':memory:');
  const { token } = store.create();
  const app = buildApp({ store, verifyIdentity: verifier });
  t.after(() => app.close());
  const created = await app.inject({ method: 'POST', url: '/api/v1/session' });
  assert.equal(created.statusCode, 401);
  assert.equal('token' in created.json(), false);
  const headers = { authorization: 'Bearer ' + token };
  for (const [method, url, payload] of [
    ['GET', '/auth/me', undefined],
    ['GET', '/dashboard', undefined],
    ['GET', '/driver/dashboard', undefined],
    ['POST', '/matches', {}],
    ['POST', '/booking-quotes', {}],
    ['POST', '/bookings', {}],
    ['POST', '/pool/bootstrap', {}],
    ['POST', '/commutes', {}],
  ] as const)
    assert.equal(
      (await app.inject({ method, url: '/api/v1' + url, headers, payload })).statusCode,
      401,
      url,
    );
  assert.equal((await app.inject({ url: '/api/v1/health' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/v1/fare-preview' })).statusCode, 200);
});
