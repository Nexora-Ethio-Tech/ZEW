// Uses the dedicated Chrome demo profile on debugging port 9235.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin = process.env.ZEW_BASE_URL || 'http://127.0.0.1:3000';
const tab = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then((r) =>
  r.json(),
);
const ws = new WebSocket(tab.webSocketDebuggerUrl),
  pending = new Map(),
  errors = [];
let counter = 0;
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  // Never use automated map interaction to fetch public OSM tiles. Test map controls with an inert tile.
  if (data.method === 'Fetch.requestPaused') {
    void send('Fetch.fulfillRequest', {
      requestId: data.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
      body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    }).catch(() => {});
  }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (!data.id) return;
  const task = pending.get(data.id);
  if (!task) return;
  pending.delete(data.id);
  data.error ? task.reject(new Error(data.error.message)) : task.resolve(data.result);
});
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await pause(150);
  }
  throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
}
const click = (text) =>
  evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw new Error('Button unavailable: '+${JSON.stringify(text)});b.click();})()`,
  );
const labelled = (label) =>
  evaluate(`document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}).click()`);
const select = (selector, value) =>
  evaluate(
    `(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
const fare = (value) =>
  wait(
    `document.querySelector('.group-fare strong')?.textContent===${JSON.stringify(String(value))}`,
  );
const screenshot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`/tmp/${name}.png`, Buffer.from(r.data, 'base64'));
};
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*tile.openstreetmap.org/*' }] });
  await send('Page.navigate', { url: origin });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait('!!document.querySelector(".group-card")');
  await evaluate('localStorage.removeItem("zew-demo-session")');
  await send('Page.reload');
  await pause(400);
  await wait('!!document.querySelector(".group-card")');
  await fare(360);
  await screenshot('zew-circle-desktop');
  await labelled('Add Sara M.');
  await fare(180);
  await labelled('Add Bereket A.');
  await fare(120);
  await labelled('Add Eden T.');
  await fare(90);
  await screenshot('zew-circle-full');
  await click('All demo riders');
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify('[aria-label="Add Nahom G."]')}).disabled`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify('[aria-label="Add Meron H."]')}).disabled`,
    ),
    true,
  );
  await labelled('Remove Eden T.');
  await fare(120);
  await click('Request this group');
  await wait('document.body.innerText.includes("Your group is ready to go.")');
  await click('Try the driver view');
  await wait('!!document.querySelector(".group-call-card")');
  await select('#demo-driver', 'abel');
  await wait('document.body.innerText.includes("Last pickup would exceed 2 minutes")');
  await select('#demo-driver', 'hana');
  await click('Accept group request');
  await wait('document.body.innerText.includes("Hana T. accepted your group!")');
  await click('Start demo ride');
  await wait('document.body.innerText.includes("Enjoy the shared journey.")');
  await click('Complete demo ride');
  await wait('document.body.innerText.includes("Demo trip completed.")');
  await evaluate('document.querySelectorAll(".pool-sidebar nav button")[1].click()');
  await wait('document.querySelectorAll(".pool-history-card").length===3');
  await click('Build another group');
  await fare(360);
  await evaluate('document.querySelector(".pool-sidebar nav button").click()');
  // Deterministic device GPS fixtures; never reads the user's real coordinates.
  await send('Browser.setPermission', {
    permission: { name: 'geolocation' },
    setting: 'granted',
    origin,
  });
  await send('Emulation.setGeolocationOverride', {
    latitude: 8.9982,
    longitude: 38.7865,
    accuracy: 15,
  });
  await click('Use my location');
  await wait('document.querySelector("#place-pickup")?.value === "Your device location"');
  assert.ok(await evaluate('document.body.innerText.includes("accuracy ±15m")'));
  await send('Emulation.setGeolocationOverride', { latitude: 0, longitude: 0, accuracy: 10 });
  await click('Use my location');
  await wait('document.body.innerText.includes("accuracy ±10m")');
  assert.equal(await evaluate('document.querySelector(".request-group").disabled'), false);
  // Real geocoder through the API; not limited to the original Addis pickup zones.
  await evaluate(
    `(()=>{const input=document.querySelector('#place-pickup');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Adama Ethiopia');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await evaluate(`document.querySelector('#place-pickup').closest('form').requestSubmit()`);
  await wait('!!document.querySelector(".place-results button:not(.close-place-results)")');
  await evaluate(
    'document.querySelector(".place-results button:not(.close-place-results)").click()',
  );
  await wait('!document.querySelector(".place-results")');
  const searchedPickup = await evaluate('document.querySelector("#place-pickup").value');
  assert.notEqual(searchedPickup, 'Your device location');
  await click('Set destination on map');
  await evaluate('document.querySelector(".street-map").scrollIntoView({block:"center"})');
  const point = await evaluate(
    '(()=>{const r=document.querySelector(".street-map").getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.55};})()',
  );
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...point,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...point,
    button: 'left',
    clickCount: 1,
  });
  await wait('!!document.querySelector(".map-pin-confirm")');
  await click('Confirm destination');
  await wait('document.querySelector("#place-destination").value.startsWith("Map pin")');
  await send('Browser.setPermission', {
    permission: { name: 'geolocation' },
    setting: 'denied',
    origin,
  });
  await click('Use my location');
  await wait('document.body.innerText.includes("Location permission was declined")');
  await labelled('Dismiss error');
  await labelled('Skip Sara M.');
  await wait(`!document.querySelector(${JSON.stringify('[aria-label="Add Sara M."]')})`);
  await click('Refresh demo');
  await wait(`!!document.querySelector(${JSON.stringify('[aria-label="Add Sara M."]')})`);
  await labelled('Add Sara M.');
  await fare(180);
  await send('Page.reload');
  await pause(400);
  await fare(180);
  assert.equal(await evaluate('document.querySelector("#place-pickup").value'), searchedPickup);
  assert.ok(
    await evaluate('document.querySelector("#place-destination").value.startsWith("Map pin")'),
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(250);
  assert.equal(
    await evaluate('document.documentElement.scrollWidth<=innerWidth'),
    true,
    'No mobile overflow',
  );
  await screenshot('zew-circle-mobile');
  await evaluate('document.querySelector(".group-card").scrollIntoView()');
  await pause(250);
  await screenshot('zew-circle-mobile-fare');
  assert.deepEqual(errors, [], 'No browser exceptions');
  console.log(
    'PASS: group fares/lifecycle, two-minute rules, arbitrary GPS, permission denial, live place search, map-pin selection, custom-place persistence and mobile layout. OSM tiles stubbed for automated testing.',
  );
  console.log(
    'Screenshots: /tmp/zew-circle-desktop.png, /tmp/zew-circle-full.png, /tmp/zew-circle-mobile.png, /tmp/zew-circle-mobile-fare.png',
  );
} finally {
  await send('Browser.resetPermissions').catch(() => {});
  await send('Emulation.clearGeolocationOverride').catch(() => {});
  ws.close();
}
