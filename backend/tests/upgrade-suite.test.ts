import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountApp as buildApp, passengerSession } from './helpers.js';
import {
  generateTelebirrSignature,
  verifyTelebirrSignature,
} from '../src/modules/payments/model.js';
import { calculateRoadRoute, haversineKm } from '../src/modules/routing/service.js';

test('Telebirr HMAC signature generation & verification works correctly', () => {
  const payload = {
    outTradeNo: 'ZEW-TB-1002',
    mchShortCode: '10294',
    totalAmount: 120,
    status: 'SUCCESS',
  };

  const sign = generateTelebirrSignature(payload);
  assert.equal(typeof sign, 'string');
  assert.equal(sign.length, 64);

  const isValid = verifyTelebirrSignature({ ...payload, sign, status: 'SUCCESS' });
  assert.equal(isValid, true);

  const isInvalid = verifyTelebirrSignature({
    ...payload,
    sign: 'TAMPERED_SIGNATURE_HASH',
    status: 'SUCCESS',
  });
  assert.equal(isInvalid, false);
});

test('OSRM and Addis Ababa road matrix calculates true road distance & ETA', async () => {
  const bole = { latitude: 8.9982, longitude: 38.7865 };
  const meskel = { latitude: 9.0105, longitude: 38.7618 };

  const directKm = haversineKm(bole, meskel);
  assert.ok(directKm > 2 && directKm < 5);

  const routeResult = await calculateRoadRoute(bole, meskel);
  assert.ok(routeResult.roadDistanceKm > directKm);
  assert.ok(routeResult.etaMinutes >= 2);
  assert.ok(routeResult.routeSummary.includes('Bole Road'));
  assert.equal(routeResult.provider, 'addis_road_matrix_fallback');
});

test('unconfigured real payments fail closed and do not accept a client payment outcome', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const { token } = (await passengerSession(app)).json();
  const headers = { authorization: `Bearer ${token}` };
  for (const url of ['/api/v1/payments/telebirr/initiate', '/api/v1/payments/telebirr/webhook']) {
    const response = await app.inject({
      method: 'POST',
      url,
      headers,
      payload: { amount: 1, status: 'SUCCESS' },
    });
    assert.equal(response.statusCode, 501);
    assert.equal(response.json().mode, 'demo');
  }
  assert.equal(
    (await app.inject({ url: '/api/v1/payments/fabricated/status', headers })).statusCode,
    501,
  );
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/v1/payments/telebirr/initiate', payload: {} }))
      .statusCode,
    401,
  );
});
