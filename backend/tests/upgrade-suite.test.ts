import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { generateTelebirrSignature, verifyTelebirrSignature } from '../src/modules/payments/model.js';
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

  const isInvalid = verifyTelebirrSignature({ ...payload, sign: 'TAMPERED_SIGNATURE_HASH', status: 'SUCCESS' });
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

test('Telebirr API payment initiation and webhook callback workflow', async () => {
  const app = buildApp({ databasePath: ':memory:' });

  try {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/session',
    });
    assert.equal(sessionRes.statusCode, 201);
    const { token } = JSON.parse(sessionRes.body);

    // Initiate Telebirr payment
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/telebirr/initiate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        groupId: 'demo-history-1',
        phoneNumber: '0911234567',
        amount: 120,
      },
    });

    assert.equal(initRes.statusCode, 201);
    const initBody = JSON.parse(initRes.body);
    assert.equal(initBody.status, 'pending_telebirr');
    assert.ok(initBody.outTradeNo.startsWith('ZEW-TB-'));
    assert.ok(initBody.ussdPushNotice.includes('0911234567'));

    // Webhook callback simulation
    const webhookPayload = {
      outTradeNo: initBody.outTradeNo,
      mchShortCode: '10294',
      totalAmount: 120,
      status: 'SUCCESS',
    };
    const sign = generateTelebirrSignature(webhookPayload);

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/telebirr/webhook',
      payload: { ...webhookPayload, sign },
    });

    assert.equal(webhookRes.statusCode, 200);
    const webhookResponseBody = JSON.parse(webhookRes.body);
    assert.equal(webhookResponseBody.result, 'SUCCESS');
  } finally {
    await app.close();
  }
});
