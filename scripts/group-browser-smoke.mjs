// Uses the dedicated Chrome demo profile on debugging port 9235.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin = process.env.ZEW_BASE_URL || 'http://localhost:3000';
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
    const places = data.params.request.url.includes('/places/search');
    void send('Fetch.fulfillRequest', {
      requestId: data.params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: places ? 'application/json' : 'image/png' }],
      body: places
        ? Buffer.from(
            JSON.stringify({
              places: [{ name: 'Adama, Ethiopia', latitude: 8.54, longitude: 39.27 }],
            }),
          ).toString('base64')
        : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
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
  throw new Error(`Timed out: ${expression}`);
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
const input = (selector, value) =>
  evaluate(
    `(()=>{const field=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));})()`,
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
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: '*tile.openstreetmap.org/*' },
      ...(process.env.ZEW_LIVE_PLACES === '1' ? [] : [{ urlPattern: '*/api/v1/places/search' }]),
    ],
  });
  await send('Page.navigate', { url: `${origin}/demo` });
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
  await wait('!document.querySelector(".group-fare") && !!document.querySelector("#maximum-fare")');
  assert.equal(await evaluate('document.querySelector(".group-seats") === null'), true);
  await screenshot('zew-circle-desktop');
  await labelled('Your demo account');
  assert.equal(
    await evaluate('document.querySelectorAll("dialog[open]").length'),
    1,
    'Account opens exactly one dialog',
  );
  await labelled('Close dialog');
  assert.equal(await evaluate('document.body.innerText.includes("SIMULATED DEMAND")'), true);
  await wait('document.querySelectorAll(".leaflet-overlay-pane path").length >= 5');
  assert.equal(await evaluate('document.querySelector(".map-overlay-box")?.textContent.includes("Simulated locations")'), true);
  assert.equal(await evaluate('document.querySelector(".map-overlay-box")?.textContent.includes("Red dots")'), false);
  await input('#minimum-people', '2');
  await wait('document.querySelector("#minimum-people")?.value === "2" && !document.querySelector("#minimum-people").disabled');
  await input('#maximum-people', '6');
  await wait('document.querySelector("#maximum-people")?.value === "6"');
  await input('#maximum-fare', '125');
  await wait('document.querySelector("#maximum-fare")?.value === "125"');
  await click('Apply for a shared ride');
  await fare(90);
  await screenshot('zew-circle-full');
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
  await wait('!document.querySelector(".group-fare") && document.querySelector("#maximum-fare")?.value === "125"');
  await evaluate('document.querySelector(".pool-sidebar nav button").click()');
  await wait('[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Use my location" && !button.disabled)');
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
  await wait('document.body.innerText.includes("Choose a location in Ethiopia")');
  await labelled('Dismiss error');
  assert.equal(await evaluate('document.querySelector(".request-group").disabled'), false);
  // Search interaction is deterministic by default; opt into the public geocoder with ZEW_LIVE_PLACES=1.
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
  if (await evaluate('document.querySelector(".real-map-card")?.classList.contains("is-collapsed")')) {
    await evaluate('document.querySelector(".map-collapse-btn-bordered").click()');
  }
  await wait('[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Set destination on map" && !button.disabled)');
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
  await click('Refresh demo');
  await wait('!document.querySelector(".group-fare") && !!document.querySelector(".request-group")');
  await send('Page.reload');
  await pause(400);
  await wait('!document.querySelector(".group-fare") && !!document.querySelector(".request-group")');
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
  await labelled('Your demo account');
  assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'), 1);
  assert.equal(
    await evaluate(
      'document.querySelector("dialog").scrollWidth <= document.querySelector("dialog").clientWidth',
    ),
    true,
    'Dialog fits mobile viewport',
  );
  await labelled('Close dialog');
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await wait('document.body.innerText.includes("You’re offline")');
  assert.equal(await evaluate('document.querySelector(".request-group").disabled'), true);
  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await wait('!document.body.innerText.includes("You’re offline")');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 760,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(200);
  assert.equal(
    await evaluate('document.documentElement.scrollWidth<=innerWidth'),
    true,
    'No narrow mobile overflow',
  );
  // Provider/user place labels must remain inert text inside Leaflet popups.
  await evaluate(
    `fetch('/api/v1/pool/place', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('zew-demo-session')},body:JSON.stringify({target:'pickup',place:{name:'<img src=x onerror="window.__zewInjected=true">',latitude:8.54,longitude:39.27}})}).then(r=>{if(!r.ok)throw new Error('Could not create text-only map fixture');})`,
  );
  await send('Page.reload');
  await wait('!!document.querySelector(".leaflet-marker-icon")');
  await evaluate('document.querySelector(".leaflet-marker-icon").click()');
  await wait('!!document.querySelector(".map-marker-popup")');
  assert.equal(
    await evaluate('!!document.querySelector(".map-marker-popup img")'),
    false,
    'Map names are text, never HTML',
  );
  assert.equal(
    await evaluate('window.__zewInjected === true'),
    false,
    'Map labels cannot execute scripts',
  );
  assert.deepEqual(errors, [], 'No browser exceptions');
  console.log(
    'PASS: min/max people and fare limit, automatic demo grouping, locked fare, simulated demand overlay, lifecycle, Ethiopia-bounded GPS, permission denial, place selection, map pins, persistence, single account dialog, offline recovery, mobile layout and inert map labels. Public tiles stubbed; live search is opt-in.',
  );
  console.log(
    'Screenshots: /tmp/zew-circle-desktop.png, /tmp/zew-circle-full.png, /tmp/zew-circle-mobile.png, /tmp/zew-circle-mobile-fare.png',
  );
} finally {
  await send('Browser.resetPermissions').catch(() => {});
  await send('Emulation.clearGeolocationOverride').catch(() => {});
  ws.close();
}
