// Run with: node --import ./backend/node_modules/tsx/dist/loader.mjs scripts/planned-browser-smoke.mjs
// Uses an isolated in-memory API and a dedicated Chrome profile on port 9235.
// No provider account or production authentication bypass is created.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildApp } from '../backend/src/app.ts';

const app = buildApp();
const origin = process.env.ZEW_BASE_URL || 'http://localhost:3000';
const tab = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then((r) =>
  r.json(),
);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
const tasks = new Map();
const errors = [];
let sequence = 0;
let lostConfirmation = false;
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
        if (
          new URL(request.url).pathname === '/api/v1/bookings' &&
          result.statusCode === 201 &&
          !lostConfirmation
        ) {
          lostConfirmation = true;
          await send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
          return;
        }
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
    source: 'localStorage.clear();',
  });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: origin + '/planned' });
  await wait('!!document.querySelector(".search-card")');
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
  // Polling must not remount the autocomplete or erase a partially entered query.
  await evaluate(
    `(()=>{const input=document.querySelector('[role="combobox"]');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Bol');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 6000));
  assert.equal(await evaluate('document.activeElement?.value'), 'Bol');
  await evaluate('document.querySelector(".planned-place-results button").click()');
  await evaluate(
    `(()=>{const field=document.querySelector('[aria-label="Seats to reserve"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,'2');field.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await click('Find my ride');
  await wait('document.querySelectorAll(".match-card").length > 0');
  await evaluate('document.querySelector(".driver-profile-trigger").click()');
  await wait('!!document.querySelector("dialog[open]")');
  assert.equal(
    await evaluate(
      'document.body.innerText.includes("4.9") || document.body.innerText.includes("148 Shared") || document.body.innerText.includes("AA 2-B4091")',
    ),
    false,
  );
  await click('Review reservation');
  assert.equal(
    await evaluate('document.querySelector("[data-reserved-seats]").textContent'),
    '2 seats',
  );
  const total = await evaluate('document.querySelector("[data-reservation-total]").textContent');
  assert.equal(total, '200 ETB');
  await click('Confirm preview reservation');
  await wait('document.body.innerText.includes("Cannot reach Zew")');
  await click('Confirm preview reservation');
  await wait('!!document.querySelector(".booking-card")');
  assert.equal(await evaluate('document.querySelectorAll(".booking-card").length'), 1);
  assert.equal(lostConfirmation, true);
  assert.equal(await evaluate('document.querySelector(".booking-fare strong").textContent'), total);
  assert.equal(
    await evaluate('document.querySelector(".booking-card").textContent.includes("2 seats")'),
    true,
  );
  await click('Cancel reservation');
  await wait('!document.querySelector(".booking-card")');
  await click('Past rides');
  await wait('document.querySelector(".status-pill")?.textContent === "Cancelled"');
  await click('Plan ahead');
  await click('Save this commute');
  await evaluate(
    `(()=>{const field=document.querySelector('input[name="name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Work');field.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click('Save commute');
  await wait('!document.querySelector("dialog[open]")');
  await send('Page.reload');
  await wait('!!document.querySelector(".search-card")');
  await click('Saved commutes');
  await wait('document.querySelector(".saved-card h2")?.textContent === "Work"');
  await click('Use this route');
  await wait('!!document.querySelector(".search-card")');
  assert.equal(
    await evaluate(`document.querySelector('[aria-label="Seats to reserve"]').value`),
    '2',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await shot('zew-planned-refactor-mobile');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: autocomplete survives polling; two-seat quote equals reservation; lost confirmation retries once; truthful driver details; cancellation; saved commute persistence; mobile layout.',
  );
} finally {
  socket.close();
  await app.close();
  await fetch('http://127.0.0.1:9235/json/close/' + tab.id).catch(() => {});
}
