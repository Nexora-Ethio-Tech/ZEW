// Record the actual frontend against an isolated in-memory instance of the real API.
// Only identity verification is a fixture; booking, fares, dispatch and transitions are real code.
// No production credentials or user records are read. Run with the backend TS loader.
import { buildApp } from '../backend/src/app.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = '/tmp/zew-product-recording';
mkdirSync(dir, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const app = buildApp({
  verifyIdentity: async () => ({
    id: 'recording-driver',
    email: 'nexoratechnologyplc@gmail.com',
    name: 'Nexora',
    emailConfirmed: true,
  }),
});
const driver = (
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer recording-fixture' },
  })
).json();
const rider = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json();
const errors = [];
async function connect(url, intercept = false) {
  const ws = new WebSocket(url),
    pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Fetch.requestPaused')
      void (async () => {
        const { request, requestId } = msg.params,
          u = new URL(request.url);
        if (u.pathname === '/api/v1/stream') {
          await send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'text/event-stream' }],
            body: '',
          });
          return;
        }
        const headers = Object.fromEntries(
          Object.entries(request.headers).filter(([k]) =>
            ['authorization', 'content-type', 'idempotency-key'].includes(k.toLowerCase()),
          ),
        );
        const result = await app.inject({
          url: u.pathname + u.search,
          method: request.method,
          headers,
          payload: request.postData,
        });
        if (result.statusCode >= 400)
          errors.push(`${request.method} ${u.pathname}: ${result.statusCode}`);
        await send('Fetch.fulfillRequest', {
          requestId,
          responseCode: result.statusCode,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(result.body).toString('base64'),
        });
      })().catch(() => errors.push('Interception error'));
    if (!msg.id) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(Error(msg.error.message)) : p.resolve(msg.result);
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error('Browser evaluation failed');
    return r.result.value;
  };
  const wait = async (expression) => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await pause(150);
    }
    throw Error('Timed out: ' + expression);
  };
  if (intercept) {
    await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
    await send('Network.setBypassServiceWorker', { bypass: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  return { ws, send, evaluate, wait };
}
const version = await fetch('http://127.0.0.1:9235/json/version').then((r) => r.json());
const browser = await connect(version.webSocketDebuggerUrl);
const contexts = [];
const pages = [];
async function page(account, path) {
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  const { targetId } = await browser.send('Target.createTarget', {
    url: 'about:blank',
    browserContextId,
  });
  const tabs = await fetch('http://127.0.0.1:9235/json').then((r) => r.json());
  const p = await connect(tabs.find((t) => t.id === targetId).webSocketDebuggerUrl, true);
  pages.push(p);
  await p.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('zew-theme','light');${account ? `localStorage.setItem('zew-demo-session',${JSON.stringify(account.token)});${account.user ? `localStorage.setItem('zew-user-account',${JSON.stringify(JSON.stringify(account.user))});` : ''}` : ''}`,
  });
  await p.send('Page.navigate', { url: 'http://localhost:3000' + path });
  await p.wait('document.readyState === "complete"');
  // Hide only development tooling, never product or preview labels.
  await p.evaluate(
    `(()=>{const s=document.createElement('style');s.textContent='nextjs-portal { display:none !important }';document.head.append(s);})()`,
  );
  await p.evaluate(
    `(()=>{const cursor=document.createElement('div');cursor.id='recording-cursor';cursor.style.cssText='position:fixed;left:-50px;top:-50px;width:18px;height:18px;border:3px solid #315c48;border-radius:50%;background:#d5ee8355;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%);transition:width .15s,height .15s';document.body.append(cursor);document.addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});document.addEventListener('mousedown',()=>{cursor.style.width='32px';cursor.style.height='32px'});document.addEventListener('mouseup',()=>{setTimeout(()=>{cursor.style.width='18px';cursor.style.height='18px'},250)});})()`,
  );
  return p;
}
async function shot(p, name) {
  const r = await p.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${dir}/${name}.png`, Buffer.from(r.data, 'base64'));
}
async function focus(p, selector) {
  await p.evaluate(
    `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({behavior:'smooth',block:'center'})`,
  );
  await pause(700);
}
async function click(p, selector) {
  await focus(p, selector);
  const box = await p.evaluate(
    `(()=>{let r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
  await pause(300);
  await p.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...box,
  });
  await p.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...box,
  });
}
async function button(p, label) {
  await p.wait(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
  );
  const selector = await p.evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable');b.dataset.recordButton='target';return '[data-record-button="target"]'})()`,
  );
  await click(p, selector);
  await p.evaluate(
    `document.querySelector('[data-record-button="target"]')?.removeAttribute('data-record-button')`,
  );
}
async function input(p, selector, value) {
  await click(p, selector);
  await p.evaluate(
    `(()=>{const f=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,${JSON.stringify(value)});f.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await pause(300);
}

let elapsed = 0,
  frame = 0;
const chapters = [],
  concat = [];
async function scene(p, title, caption, seconds, action) {
  console.log('Recording: ' + title);
  await p.send('Page.bringToFront');
  const start = Date.now();
  let done = false,
    actionError;
  let lastFrame;
  const actionTask = (async () => {
    await pause(1000);
    try {
      if (action) await action();
    } catch (e) {
      actionError = e;
    }
    done = true;
  })();
  let i = 0;
  while (Date.now() - start < seconds * 1000 || !done) {
    const at = Date.now();
    const r = await p.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    const name = `frame-${String(frame++).padStart(6, '0')}.jpg`;
    writeFileSync(`${dir}/${name}`, Buffer.from(r.data, 'base64'));
    const t = i === 0 ? 0 : (Date.now() - start) / 1000;
    if (lastFrame) {
      concat.push(`file '${lastFrame.name}'\nduration ${(t - lastFrame.t).toFixed(4)}`);
    }
    lastFrame = { name, t };
    i++;
    await pause(Math.max(0, 83 - (Date.now() - at)));
  }
  await actionTask;
  if (actionError) throw actionError;
  const duration = (Date.now() - start) / 1000;
  concat.push(
    `file '${lastFrame.name}'\nduration ${Math.max(0.01, duration - lastFrame.t).toFixed(4)}`,
  );
  chapters.push({ start: elapsed, end: elapsed + duration, title, caption });
  elapsed += duration;
  await shot(p, `scene-${chapters.length}`);
  writeFileSync(`${dir}/frames.txt`, concat.join('\n') + '\n');
  writeFileSync(`${dir}/chapters.json`, JSON.stringify(chapters, null, 2));
}
try {
  const landing = await page(null, '/');
  await landing.wait('!!document.querySelector(".landing-shell")');
  const passenger = await page(rider, '/rides');
  await passenger.wait('!!document.querySelector("#maximum-fare")');
  const driving = await page(driver, '/driver');
  await driving.wait('!!document.querySelector(".driver-empty")');
  if (process.argv.includes('--preview')) {
    await shot(landing, 'preview-landing');
    await shot(passenger, 'preview-passenger');
    await shot(driving, 'preview-driver');
    console.log('Preview screenshots ready.');
  } else {
    await scene(
      landing,
      'ZEW / PRODUCT WALKTHROUGH',
      'Shared journeys in Addis Ababa. One request, two separate workspaces.',
      9,
    );
    await scene(
      passenger,
      '01 / PLAN A SHARED RIDE',
      'The passenger starts with a pickup and destination. Here: Bole to Meskel Square.',
      10,
    );
    await scene(
      passenger,
      '02 / SET YOUR LIMITS',
      'Choose 2–4 people and a maximum fare of 125 ETB. Review the projected split.',
      12,
      async () => {
        await input(passenger, '#minimum-people', '2');
        await input(passenger, '#maximum-fare', '125');
        await focus(passenger, '.auto-group-box');
      },
    );
    await scene(
      passenger,
      '03 / UNDERSTAND THE FARE',
      'The total is shared equally. Matching locks the fare for the selected group.',
      9,
      async () => {
        await click(passenger, '.fare-explain');
        await passenger.wait('!!document.querySelector("dialog[open]")');
      },
    );
    await click(passenger, '[aria-label="Close dialog"]');
    // Refresh through the UI so recording time cannot consume the short pickup window.
    await button(passenger, 'Refresh availability');
    await scene(
      passenger,
      '04 / REQUEST YOUR RIDE',
      'Apply once. The API checks compatible direction, readiness, capacity and fare limits.',
      10,
      async () => {
        await button(passenger, 'Apply for a shared ride');
        await passenger.wait('!!document.querySelector(".group-status-panel.requested")');
        await focus(passenger, '.group-card');
        await passenger.wait('document.querySelector(".group-fare strong")?.textContent === "90"');
      },
    );
    await scene(
      passenger,
      'PASSENGER / GROUP CONFIRMED',
      'Four people share a 360 ETB trip: 90 ETB each. The request now awaits its assigned driver.',
      9,
    );
    await driving.send('Page.bringToFront');
    await driving.wait('!!document.querySelector(".driver-request")');
    await scene(
      driving,
      '05 / THE DRIVER RECEIVES THE REQUEST',
      'A separate driver account sees the assigned journey, passenger seats and projected payout.',
      10,
    );
    await scene(
      driving,
      'DRIVER / ACCEPT THE JOURNEY',
      'The driver accepts the request. Only the assigned driver can update this ride.',
      8,
      async () => {
        await button(driving, 'Accept request');
        await driving.wait('!!document.querySelector(".driver-actions input")');
      },
    );
    await passenger.send('Page.bringToFront');
    await passenger.wait('!!document.querySelector(".boarding-code")');
    await focus(passenger, '.group-status-panel');
    await scene(
      passenger,
      '06 / CONFIRM BOARDING',
      'The passenger receives a boarding code and shares it with the driver when boarding.',
      10,
    );
    const accepted = (
      await app.inject({ url: '/api/v1/pool', headers: { authorization: 'Bearer ' + rider.token } })
    ).json();
    await scene(
      driving,
      'DRIVER / VERIFY & START',
      'Entering the passenger’s code starts the ride. The fare stays locked.',
      10,
      async () => {
        await input(driving, '.driver-actions input', accepted.boardingCode);
        await button(driving, 'Confirm boarding & start');
        await driving.wait('document.body.innerText.includes("Complete ride")');
      },
    );
    await passenger.send('Page.bringToFront');
    await passenger.wait('!!document.querySelector(".group-status-panel.in_progress")');
    await focus(passenger, '.group-status-panel');
    await scene(
      passenger,
      'PASSENGER / RIDE IN PROGRESS',
      'Both workspaces reflect the same trip state. No additional riders are added.',
      8,
    );
    await scene(
      driving,
      '07 / COMPLETE THE RIDE',
      'At the end of the journey, the driver completes the ride and a record is saved.',
      9,
      async () => {
        await button(driving, 'Complete ride');
        await driving.wait(
          'document.querySelector(".driver-request-top strong")?.textContent === "completed"',
        );
      },
    );
    await passenger.send('Page.bringToFront');
    await passenger.wait('!!document.querySelector(".group-status-panel.completed")');
    await scene(
      passenger,
      'PASSENGER / RIDE HISTORY',
      'My rides keeps the completed journey and fare details in the passenger’s workspace.',
      10,
      async () => {
        await click(passenger, '.pool-sidebar nav button:nth-of-type(2)');
        await passenger.wait('!!document.querySelector(".pool-history-card")');
        await passenger.evaluate('window.scrollTo({top:0,behavior:"smooth"})');
      },
    );
    await scene(
      driving,
      'DRIVER / EARNINGS',
      'A 360 ETB trip produces a projected 324 ETB driver payout after the 10% platform fee.',
      10,
      async () => {
        await button(driving, 'Earnings');
        await driving.wait('!!document.querySelector(".driver-earnings")');
      },
    );
    const planned = await page(rider, '/planned');
    await planned.wait('!!document.querySelector("form")');
    await scene(
      planned,
      '08 / PLAN AHEAD',
      'Passengers can also choose a departure time and search for a planned commute.',
      10,
      async () => {
        await button(planned, 'Find my ride');
        await planned.wait('!!document.querySelector(".match-card")');
      },
    );
    await scene(
      planned,
      'PLANNED COMMUTES / REVIEW & RESERVE',
      'Review the driver, departure and seat fare before confirming a preview reservation.',
      10,
      async () => {
        await button(planned, 'Choose ride');
        await planned.wait('!!document.querySelector("dialog[open]")');
      },
    );
    await scene(
      planned,
      'PLANNED COMMUTES / REQUEST SAVED',
      'The reservation holds a seat and creates another request for the assigned driver.',
      9,
      async () => {
        await button(planned, 'Confirm preview reservation');
        await planned.wait('!document.querySelector("dialog[open]")');
        await planned.evaluate('window.scrollTo({top:0,behavior:"smooth"})');
      },
    );
    await scene(
      driving,
      'DRIVER / ONE INBOX FOR BOTH JOURNEYS',
      'Ride circles and planned reservations arrive in the same dedicated driver workspace.',
      9,
      async () => {
        await click(driving, '.driver-sidebar nav button:first-child');
        await driving.wait(
          'document.querySelector(".driver-request-top span")?.textContent === "PLANNED RIDE"',
        );
      },
    );
    await scene(
      landing,
      'ZEW / SAME WAY. BETTER TOGETHER.',
      'Working product preview · Staged matching and transport estimates · No real payments',
      8,
    );
    writeFileSync(`${dir}/frames.txt`, concat.join('\n') + '\n');
    writeFileSync(`${dir}/chapters.json`, JSON.stringify(chapters, null, 2));
    console.log(
      JSON.stringify({
        duration: elapsed,
        frames: frame,
        scenes: chapters.length,
        apiErrors: errors,
      }),
    );
  }
} finally {
  for (const p of pages) p.ws.close();
  for (const browserContextId of contexts)
    await browser.send('Target.disposeBrowserContext', { browserContextId });
  browser.ws.close();
  await app.close();
}
