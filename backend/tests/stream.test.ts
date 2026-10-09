import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountApp as buildApp, passengerSession } from './helpers.js';

test('stream uses bearer headers, sends simulation events and shuts down cleanly', async (t) => {
  const app = buildApp();
  const controller = new AbortController();
  t.after(async () => {
    controller.abort();
    await app.close();
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const { token } = (await passengerSession(app)).json();
  assert.equal((await fetch(`${base}/stream?token=${token}`)).status, 401);
  const response = await fetch(`${base}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = response.body!.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /event: heartbeat/);
  await reader.cancel();
});
