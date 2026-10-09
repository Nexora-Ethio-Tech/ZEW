// Operator-only setup. Credentials are read from the ignored backend environment file.
const required = [
  'SUPABASE_URL',
  'SUPABASE_ACCESS_TOKEN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_ADMIN_EMAIL',
  'SMTP_SENDER_NAME',
];
if (required.some((key) => !process.env[key])) {
  console.error(
    'Missing backend email configuration. Set the SMTP variables and SUPABASE_ACCESS_TOKEN in backend/.env.',
  );
  process.exit(1);
}
const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error('Expected the configured Supabase project URL.');
  process.exit(1);
}
const endpoint = 'https://api.supabase.com/v1/projects/' + projectRef + '/config/auth';
const headers = {
  Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
  'Content-Type': 'application/json',
};
async function request(method = 'GET', body) {
  const response = await fetch(endpoint, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      'Supabase auth configuration ' + method + ' failed (HTTP ' + response.status + ').',
    );
  return response.json();
}
try {
  const previous = await request();
  const origin = new URL(process.env.FRONTEND_ORIGIN || 'http://localhost:3000').origin;
  const allowed = new Set(
    (previous.uri_allow_list || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  allowed.add(origin + '/auth/callback');
  allowed.add(origin + '/');
  const desired = {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    smtp_host: process.env.SMTP_HOST,
    smtp_port: process.env.SMTP_PORT,
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS.replace(/\s/g, ''),
    smtp_admin_email: process.env.SMTP_ADMIN_EMAIL,
    smtp_sender_name: process.env.SMTP_SENDER_NAME,
    uri_allow_list: [...allowed].join(','),
  };
  await request('PATCH', desired);
  const saved = await request();
  if (
    saved.smtp_host !== desired.smtp_host ||
    saved.smtp_user !== desired.smtp_user ||
    saved.smtp_admin_email !== desired.smtp_admin_email ||
    saved.smtp_sender_name !== desired.smtp_sender_name ||
    saved.mailer_autoconfirm !== false ||
    !saved.uri_allow_list?.split(',').includes(origin + '/auth/callback')
  )
    throw new Error('The saved email settings did not match the requested configuration.');
  console.log(
    'SMTP settings and callback URL saved and verified. Email confirmation remains enabled.',
  );
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith('Supabase auth configuration')
      ? error.message
      : 'Could not configure and verify Supabase email delivery.',
  );
  process.exitCode = 1;
}
