// Browser contract checks: provider calls are intercepted, so this does not send email or create accounts.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const origin = process.env.ZEW_BASE_URL || 'http://localhost:3000';
const tab = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then((r) =>
  r.json(),
);
const ws = new WebSocket(tab.webSocketDebuggerUrl),
  pending = new Map(),
  requests = [],
  errors = [];
let id = 0,
  signupFails = true;
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (m.method === 'Fetch.requestPaused')
    void (async () => {
      const { request, requestId } = m.params,
        u = new URL(request.url);
      const cors = [
        { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, OPTIONS' },
        {
          name: 'Access-Control-Allow-Headers',
          value: 'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
        },
      ];
      if (request.method === 'OPTIONS') {
        await send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors });
        return;
      }
      const body = JSON.parse(request.postData || '{}');
      requests.push({
        path: u.pathname,
        redirect: u.searchParams.get('redirect_to'),
        hasPassword: !!body.password,
        hasName: !!body.data?.name,
        type: body.type,
      });
      const failed = u.pathname.endsWith('/signup') && signupFails;
      const unconfirmed = u.pathname.endsWith('/token');
      await send('Fetch.fulfillRequest', {
        requestId,
        responseCode: failed || unconfirmed ? 400 : 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, ...cors],
        body: Buffer.from(
          JSON.stringify(
            failed
              ? { msg: 'Email delivery temporarily unavailable', code: 'unexpected_failure' }
              : unconfirmed
                ? {
                    msg: 'Email not confirmed',
                    code: 'email_not_confirmed',
                    error_code: 'email_not_confirmed',
                  }
                : { id: 'browser-auth-fixture', email: 'test@example.com', identities: [] },
          ),
        ).toString('base64'),
      });
    })().catch(() => errors.push('Provider interception failed'));
  if (!m.id) return;
  const task = pending.get(m.id);
  pending.delete(m.id);
  if (task) m.error ? task.reject(new Error(m.error.message)) : task.resolve(m.result);
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('Browser evaluation failed');
  return r.result.value;
};
async function wait(expression) {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out: ' + expression);
}
const fill = (selector, value) =>
  evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
const click = (label) =>
  evaluate(
    `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e||e.disabled)throw new Error('Button unavailable');e.click();})()`,
  );
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://*.supabase.co/auth/v1/*' }] });
  await send('Page.navigate', { url: origin });
  await wait('!!document.querySelector(".landing-btn-text")');
  await wait('document.querySelectorAll(".fare-people-selector button").length === 4');
  assert.equal(
    await evaluate('document.querySelector(".landing-btn-primary").getAttribute("href")'),
    '/planned',
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("a")].some(a=>["/ride","/rides","/demo"].includes(a.getAttribute("href")))',
    ),
    false,
  );
  await evaluate('document.querySelector(".landing-btn-text").click()');
  await wait('!!document.querySelector("#auth-name")');
  assert.equal(
    await evaluate('document.body.innerText.includes("Email me a sign-in link")'),
    false,
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".auth-form button[type=submit]").length'),
    1,
  );
  await fill('#auth-name', 'Browser Test');
  await fill('#auth-email', 'test@example.com');
  await fill('#auth-password', 'Browser-test-password-42!');
  await evaluate('document.querySelector(".auth-form").requestSubmit()');
  await wait(
    'document.querySelector("[role=alert]")?.textContent.includes("Email delivery temporarily unavailable")',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("#auth-title").textContent.includes("Check your inbox")',
    ),
    false,
  );
  signupFails = false;
  await evaluate('document.querySelector(".auth-form").requestSubmit()');
  await wait('document.querySelector("#auth-title").textContent.includes("Check your inbox")');
  assert.equal(
    await evaluate(
      'document.querySelector("dialog").innerText.includes("account confirmation email")',
    ),
    true,
  );
  await click('Back to sign in');
  await fill('#auth-password', 'Browser-test-password-42!');
  await evaluate('document.querySelector(".auth-form").requestSubmit()');
  await wait('document.querySelector("dialog").innerText.includes("Email not confirmed")');
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Resend confirmation email")',
    ),
    true,
  );
  await click('Forgot password?');
  assert.equal(await evaluate('!!document.querySelector("#auth-password")'), false);
  await evaluate('document.querySelector(".auth-form").requestSubmit()');
  await wait('document.querySelector("#auth-title").textContent.includes("Check your inbox")');
  assert.equal(
    await evaluate('document.querySelector("dialog").innerText.includes("password reset link")'),
    true,
  );
  const signup = requests.find((r) => r.path.endsWith('/signup')),
    recovery = requests.find((r) => r.path.endsWith('/recover'));
  assert.equal(signup.hasPassword, true);
  assert.equal(signup.hasName, true);
  assert.equal(signup.redirect, origin + '/auth/callback');
  assert.equal(recovery.redirect, origin + '/auth/reset-password');
  assert.equal(
    requests.some((r) => r.path.endsWith('/otp')),
    false,
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/zew-account-mobile.png', Buffer.from(shot.data, 'base64'));
  assert.deepEqual(errors, []);
  console.log(
    'PASS: planned-only entry; password signup; delivery errors; confirmation messaging; unconfirmed-login resend; password recovery; no passwordless calls; mobile account layout.',
  );
} finally {
  ws.close();
  await fetch('http://127.0.0.1:9235/json/close/' + tab.id).catch(() => {});
}
