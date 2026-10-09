// Landing, accessibility and account-boundary checks using a dedicated Chrome profile.
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: origin });
  await wait('!!document.querySelector(".landing-hero")');
  await wait(
    'document.querySelector(".hero-city-img")?.complete && document.querySelector(".hero-city-img")?.naturalWidth > 0',
  );
  await evaluate('document.fonts.ready.then(()=>true)');
  await wait('document.querySelectorAll(".fare-people-selector button").length === 4');
  assert.equal(await evaluate(`!!document.querySelector('a[href="/rides"]')`), true);
  await screenshot('zew-landing-desktop');
  for (const [count, fare] of [
    [1, 360],
    [2, 180],
    [3, 120],
    [4, 90],
  ]) {
    await evaluate(
      `document.querySelectorAll('.fare-people-selector button')[${count - 1}].click()`,
    );
    await wait(
      `document.querySelector('.fare-calculator-total strong').textContent === '${fare}ETB'`,
    );
  }
  await labelled('Switch to dark theme');
  await wait('document.querySelector(".landing-shell").classList.contains("dark-theme")');
  await labelled('Switch to light theme');
  await click('Log In');
  await wait('!!document.querySelector(".auth-dialog[open]")');
  assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'), 1);
  assert.equal(
    await evaluate('!!document.querySelector(".auth-form select")'),
    false,
    'Self-selected roles cannot grant privileges',
  );
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await wait('!document.querySelector("dialog[open]")');
  await evaluate("document.querySelector('.landing-btn-text').click()");
  await wait('!!document.querySelector("#auth-name")');
  assert.equal(await evaluate('document.querySelector("#auth-password").minLength'), 12);
  assert.equal(await evaluate('document.body.innerText.includes("I Checked My Email")'), false);
  await labelled('Close dialog');
  // A saved browser profile is never sufficient proof of identity.
  await evaluate(
    `localStorage.setItem('zew-user-account', JSON.stringify({id:'forged',name:'Forged',email:'fake@example.test',role:'driver'}));localStorage.setItem('zew-demo-session','0'.repeat(64));`,
  );
  await send('Page.reload');
  await wait('localStorage.getItem("zew-user-account") === null');
  assert.equal(await evaluate('!!document.querySelector(".landing-hero")'), true);
  for (const width of [768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await pause(250);
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      true,
      `No overflow at ${width}px`,
    );
    if (width === 390) await screenshot('zew-landing-mobile');
  }
  await click('Log In');
  await wait('!!document.querySelector("dialog[open]")');
  assert.equal(
    await evaluate('document.querySelector("dialog").getBoundingClientRect().width <= innerWidth'),
    true,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("dialog").scrollWidth <= document.querySelector("dialog").clientWidth',
    ),
    true,
  );
  await screenshot('zew-auth-mobile');
  assert.deepEqual(errors, [], 'No unhandled browser exceptions');
  console.log(
    'PASS: landing imagery, interactive fare calculator, themes, accessible account dialog, forged identity rejection and tablet/mobile layouts.',
  );
} finally {
  ws.close();
}
