// Run with: node --import ./backend/node_modules/tsx/dist/loader.mjs scripts/driver-browser-smoke.mjs
// Uses an isolated in-memory API and a dedicated Chrome profile on port 9235.
// No provider account or production authentication bypass is created.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildApp } from '../backend/src/app.ts';

const app = buildApp({
  verifyIdentity: async (id) => ({
    id,
    email: id === 'browser-fixture' ? 'nexoratechnologyplc@gmail.com' : id + '@example.test',
    name: 'Nexora',
    emailConfirmed: true,
  }),
});
const driver = (
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer browser-fixture' },
  })
).json();
const rider = (
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer browser-rider-one' },
  })
).json();
const riderHeaders = { authorization: 'Bearer ' + rider.token };
const riderCall = async (path, payload) =>
  app.inject({
    url: '/api/v1' + path,
    method: payload ? 'POST' : 'GET',
    headers: riderHeaders,
    payload,
  });
const draft = (await riderCall('/pool/bootstrap', {})).json();
const group = (await riderCall('/pool/apply', { version: draft.version })).json();
const origin = process.env.ZEW_BASE_URL || 'http://localhost:3000';
const tab = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then((r) =>
  r.json(),
);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
const tasks = new Map();
const errors = [];
let sequence = 0;
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    tasks.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Fetch.requestPaused')
    void (async () => {
      const { request, requestId } = message.params;
      if (new URL(request.url).pathname.startsWith('/api/v1/')) {
        const headers = Object.fromEntries(
          Object.entries(request.headers).filter(([key]) =>
            ['authorization', 'content-type', 'idempotency-key'].includes(key.toLowerCase()),
          ),
        );
        const result = await app.inject({
          url: new URL(request.url).pathname,
          method: request.method,
          headers,
          payload: request.postData,
        });
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: result.statusCode,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(result.body).toString('base64'),
        });
      } else
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
          body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        });
    })().catch(() => errors.push('API interception failed'));
  if (message.method === 'Runtime.exceptionThrown')
    errors.push(message.params.exceptionDetails.text);
  if (!message.id) return;
  const task = tasks.get(message.id);
  tasks.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message));
  else task.resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed');
  return result.result.value;
};
const wait = async (expression) => {
  for (let i = 0; i < 120; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Browser condition timed out: ' + expression);
};
const click = (label) =>
  evaluate(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) throw Error('Button unavailable'); b.click(); })()`,
  );
const shot = async (name) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/' + name + '.png', Buffer.from(shot.data, 'base64'));
};
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/v1/*' }, { urlPattern: '*tile.openstreetmap.org/*' }],
  });
  const script = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.clear();localStorage.setItem('zew-demo-session',${JSON.stringify(driver.token)});localStorage.setItem('zew-user-account',${JSON.stringify(JSON.stringify(driver.user))});`,
  });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: origin + '/driver' });
  await wait('document.querySelectorAll(".driver-request").length === 1');
  assert.equal(await evaluate('document.body.innerText.includes("Find your circle")'), false);
  await shot('zew-driver-inbox');
  await click('Accept request');
  await wait('!!document.querySelector(".driver-actions input")');
  const accepted = (await riderCall('/pool')).json();
  assert.equal(accepted.status, 'accepted');
  await evaluate(
    `(() => { const input = document.querySelector('.driver-actions input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(accepted.boardingCode)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
  );
  await click('Confirm boarding & start');
  await wait(
    '[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Complete ride")',
  );
  await click('Complete ride');
  await wait('document.querySelector(".driver-request-top strong")?.textContent === "completed"');
  assert.equal((await riderCall('/pool')).json().history[0].id, group.id);
  await click('Earnings');
  await wait('document.querySelector(".driver-earnings")?.textContent.includes("324")');
  // Two independent passenger reservations now travel as one shared departure.
  const second = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: { authorization: 'Bearer browser-rider-two' },
    })
  ).json();
  const secondHeaders = { authorization: 'Bearer ' + second.token };
  const listing = (await riderCall('/dashboard')).json().trips.find((t) => t.id === 'sample-hana');
  const journey = {
    corridorId: listing.corridorId,
    origin: 'bole',
    destination: 'meskel',
    departure: listing.departure,
    seats: 1,
    tripId: listing.id,
  };
  const reserve = async (headers) => {
    const quote = (
      await app.inject({ method: 'POST', url: '/api/v1/booking-quotes', headers, payload: journey })
    ).json();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bookings',
      headers,
      payload: { quoteId: quote.quoteId },
    });
    assert.equal(response.statusCode, 201);
    return response.json();
  };
  const firstBooking = await reserve(riderHeaders),
    secondBooking = await reserve(secondHeaders);
  await evaluate('document.querySelector(".driver-sidebar nav button").click()');
  await wait('document.querySelectorAll(".driver-request-top").length === 2');
  await click('Accept request');
  await wait(`!!document.querySelector('[aria-label="Shared departure"]')`);
  await click('Review 1 remaining request');
  await click('Accept request');
  await wait('document.querySelectorAll(".driver-actions input").length === 2');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await shot('zew-shared-departure-mobile');
  for (const booking of [firstBooking, secondBooking]) {
    await evaluate(
      `(() => { const input = document.getElementById(${JSON.stringify('code-' + booking.id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(booking.code)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await evaluate(
      `document.getElementById(${JSON.stringify('code-' + booking.id)}).closest('form').requestSubmit()`,
    );
    await wait(`!document.getElementById(${JSON.stringify('code-' + booking.id)})`);
  }
  await wait(
    '[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Complete shared ride")',
  );
  assert.equal((await riderCall('/dashboard')).json().bookings[0].status, 'in_progress');
  await click('Complete shared ride');
  await wait('document.querySelectorAll(".driver-request-top").length === 3');
  assert.equal((await riderCall('/dashboard')).json().bookings[0].status, 'completed');
  assert.equal(
    (await app.inject({ url: '/api/v1/dashboard', headers: secondHeaders })).json().bookings[0]
      .status,
    'completed',
  );
  await click('Earnings');
  await wait('document.querySelector(".driver-earnings")?.textContent.includes("504")');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await shot('zew-driver-mobile');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
  await evaluate(
    `localStorage.clear();localStorage.setItem('zew-demo-session',${JSON.stringify(rider.token)});localStorage.setItem('zew-user-account',${JSON.stringify(JSON.stringify(rider.user))})`,
  );
  await send('Page.navigate', { url: origin + '/planned?view=driver' });
  await wait('document.body.innerText.includes("Find my ride")');
  assert.equal(await evaluate('document.body.innerText.includes("Driver space")'), false);
  assert.equal(await evaluate('document.body.innerText.includes("Complete ride")'), false);
  await send('Page.navigate', { url: origin + '/driver' });
  await wait('!!document.querySelector(".driver-gate")');
  assert.equal(await evaluate('document.querySelectorAll(".driver-request").length'), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: separate driver inbox; circle completion; two private passengers board and complete one shared departure; simulated earnings; role boundaries; mobile layout.',
  );
} finally {
  socket.close();
  await app.close();
  await fetch('http://127.0.0.1:9235/json/close/' + tab.id).catch(() => {});
}
