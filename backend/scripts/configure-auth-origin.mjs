// Set deployment callbacks without touching SMTP or email-confirmation settings.
const origin = new URL(process.argv[2]).origin;
if (!origin.startsWith('https://')) throw new Error('A public HTTPS frontend origin is required.');
const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(ref) || !process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error('Configure the Supabase management credentials locally.');
const endpoint = 'https://api.supabase.com/v1/projects/' + ref + '/config/auth';
async function request(method = 'GET', body) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error('Supabase callback configuration failed: HTTP ' + response.status);
  return response.json();
}
const before = await request();
const allowed = new Set(
  (before.uri_allow_list || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
allowed.add(origin + '/auth/callback');
allowed.add(origin + '/auth/reset-password');
allowed.add(origin + '/');
await request('PATCH', { site_url: origin, uri_allow_list: [...allowed].join(',') });
const after = await request();
if (
  after.site_url !== origin ||
  !after.uri_allow_list.split(',').includes(origin + '/auth/callback') ||
  !after.uri_allow_list.split(',').includes(origin + '/auth/reset-password') ||
  after.mailer_autoconfirm !== before.mailer_autoconfirm
)
  throw new Error('Saved callback settings did not pass verification.');
console.log(
  'Production site and callback verified: ' +
    origin +
    '. Existing email confirmation settings preserved.',
);
