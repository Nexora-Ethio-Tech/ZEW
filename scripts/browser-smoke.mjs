// Browser acceptance check using Chrome's DevTools protocol; no test dependency required.
// Start Chrome with --remote-debugging-port=9235, then run this script.
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const origin = process.env.ZEW_BASE_URL || 'http://127.0.0.1:3000';
const tab = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then((r) =>
  r.json(),
);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
const tasks = new Map();
let sequence = 0;
const exceptions = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Fetch.requestPaused') {
    void send('Fetch.fulfillRequest', {
      requestId: message.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
      body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    });
  }
  if (message.method === 'Runtime.exceptionThrown')
    exceptions.push(message.params.exceptionDetails.text);
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
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    tasks.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (expression) => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await pause(150);
  }
  throw new Error(`Timed out: ${expression}; page: ${await evaluate('document.body.innerText')}`);
};
const click = (text) =>
  evaluate(
    `(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Button missing: '+${JSON.stringify(text)});button.click()})()`,
  );
const input = (selector, value) =>
  evaluate(
    `(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
const shot = async (name) => {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`/tmp/${name}.png`, Buffer.from(result.data, 'base64'));
};

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*tile.openstreetmap.org/*' }] });
  await send('Page.navigate', { url: `${origin}/planned` });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitFor('!!document.querySelector(".search-card")');
  // This script uses a dedicated Chrome profile; start a fresh test-only demo session.
  await evaluate('localStorage.removeItem("zew-demo-session")');
  await send('Page.reload');
  await pause(300);
  await waitFor('!!document.querySelector(".search-card")');
  await shot('zew-desktop');
  await click('Find my ride');
  await waitFor('document.querySelectorAll(".match-card").length===2');
  await click('Choose ride');
  await waitFor('!!document.querySelector("dialog[open]")');
  await click('Confirm demo reservation');
  await waitFor('!!document.querySelector(".boarding-code strong")');
  const code = await evaluate('document.querySelector(".boarding-code strong").textContent');
  await click('Switch to Driver Mode');
  await click('Enter boarding code');
  await input('input[name="code"]', code);
  await click('Confirm boarding');
  await waitFor('document.body.innerText.includes("Complete demo trip")');
  await click('Complete demo trip');
  await click('Earnings & Payouts');
  await waitFor('document.body.innerText.includes("90 ETB")');
  await click('Switch to Passenger Mode');
  await click('My rides');
  await click('Past rides');
  await waitFor('document.body.innerText.includes("Demo payment recorded")');
  await click('Plan ahead');
  await click('Save this commute');
  await input('input[name="name"]', 'Morning commute');
  await click('Save commute');
  await waitFor('!document.querySelector("dialog[open]")');
  await click('Saved commutes');
  await waitFor('document.body.innerText.includes("Morning commute")');
  await click('Use this route');
  await waitFor('!!document.querySelector(".search-card")');
  await click('Switch to Driver Mode');
  await click('Offer a ride');
  await input('input[name="driver"]', 'Demo Driver');
  await input('input[name="vehicle"]', 'Toyota Vitz');
  await click('Save demo offer');
  await waitFor('document.body.innerText.includes("Cancel offer")');
  await click('Cancel offer');
  await waitFor('!!document.querySelector(".offered-card .cancelled")');
  await click('Switch to Passenger Mode');
  await click('Join the pilot');
  await input('input[name="name"]', 'Browser Demo');
  await input('input[name="email"]', 'demo@example.com');
  await evaluate('document.querySelector("input[name=consent]").click()');
  await click('Save my interest');
  await waitFor('document.body.innerText.includes("Your interest is saved.")');
  await click('Back to my workspace');
  await evaluate('document.querySelector(".toast button")?.click()');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(500);
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
    true,
    'Mobile layout must not overflow',
  );
  await shot('zew-mobile');
  await send('Page.reload');
  await waitFor('!!document.querySelector(".search-card")');
  await click('Saved commutes');
  await waitFor('document.body.innerText.includes("Morning commute")');
  if (process.env.ZEW_CHECK_PWA === '1') {
    await evaluate('navigator.serviceWorker.ready.then(()=>true)');
    const manifest = await fetch(`${origin}/manifest.webmanifest`).then((r) => r.json());
    assert.equal(manifest.icons.length, 2);
    for (const icon of manifest.icons)
      assert.equal((await fetch(`${origin}${icon.src}`)).status, 200);
    const targets = await send('Target.getTargets');
    const worker = targets.targetInfos.find(
      (target) => target.type === 'service_worker' && target.url === `${origin}/sw.js`,
    );
    assert.ok(worker, 'Production service worker is running');
    const attached = await send('Target.attachToTarget', {
      targetId: worker.targetId,
      flatten: true,
    });
    const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
    const online = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    try {
      await send('Network.enable');
      await send('Network.enable', {}, attached.sessionId);
      await send('Network.emulateNetworkConditions', offline);
      await send('Network.emulateNetworkConditions', offline, attached.sessionId);
      await send('Page.navigate', { url: `${origin}/offline-check` });
      await waitFor('document.body.innerText.includes("back online.")');
    } finally {
      await send('Network.emulateNetworkConditions', online);
      await send('Network.emulateNetworkConditions', online, attached.sessionId);
      await send('Target.detachFromTarget', { sessionId: attached.sessionId });
    }
    console.log('PASS: production service worker offline fallback and manifest icons.');
  }
  assert.deepEqual(exceptions, [], 'No unhandled browser exceptions');
  console.log(
    'PASS: match → reserve → board → complete → receipt; saved commute survives reload; driver offer/cancel; mobile layout.',
  );
  console.log('Screenshots: /tmp/zew-desktop.png, /tmp/zew-mobile.png');
} finally {
  socket.close();
}
