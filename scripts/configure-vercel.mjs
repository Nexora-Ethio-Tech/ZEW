// Operator-only: uploads a strict allowlist of settings, never SMTP or management credentials.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { parseEnv } from 'node:util';
const backend = parseEnv(readFileSync(new URL('../backend/.env', import.meta.url), 'utf8'));
const auth = JSON.parse(readFileSync(homedir() + '/.local/share/com.vercel.cli/auth.json', 'utf8'));
async function api(path, method = 'GET', body) {
  const response = await fetch('https://api.vercel.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + auth.token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error(
      'Vercel configuration failed: ' +
        method +
        ' ' +
        path.split('?')[0] +
        ' HTTP ' +
        response.status,
    );
  return response.json();
}
const projects = {};
for (const directory of ['backend', 'frontend']) {
  const link = JSON.parse(
    readFileSync(new URL('../' + directory + '/.vercel/project.json', import.meta.url), 'utf8'),
  );
  const data = await api('/v9/projects/' + link.projectId + '/domains?teamId=' + link.orgId);
  const domain = data.domains.find((domain) => domain.name.endsWith('.vercel.app'))?.name;
  if (!domain) throw new Error('No Vercel production domain was assigned to ' + directory);
  projects[directory] = { ...link, origin: 'https://' + domain };
}
const apiKey = backend.SUPABASE_KEY;
if (
  !apiKey ||
  (!apiKey.startsWith('sb_publishable_') &&
    JSON.parse(Buffer.from(apiKey.split('.')[1] ?? '', 'base64url').toString()).role !== 'anon')
)
  throw new Error('Only a public Supabase key may be added to frontend settings.');
const settings = {
  backend: {
    DATABASE_URL: backend.DATABASE_URL,
    SUPABASE_URL: backend.SUPABASE_URL,
    SUPABASE_KEY: apiKey,
    FRONTEND_ORIGIN: projects.frontend.origin,
  },
  frontend: {
    API_URL: projects.backend.origin,
    NEXT_PUBLIC_SUPABASE_URL: backend.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: apiKey,
  },
};
for (const [directory, values] of Object.entries(settings)) {
  if (Object.values(values).some((value) => !value))
    throw new Error('A required deployment setting is missing.');
  const { projectId, orgId } = projects[directory];
  await api('/v9/projects/' + projectId + '?teamId=' + orgId, 'PATCH', {
    nodeVersion: '24.x',
    framework: directory === 'frontend' ? 'nextjs' : null,
    buildCommand: 'npm run build',
    installCommand: 'npm ci',
    outputDirectory: null,
  });
  await api(
    '/v10/projects/' + projectId + '/env?teamId=' + orgId + '&upsert=true',
    'POST',
    Object.entries(values).map(([key, value]) => ({
      key,
      value,
      type: 'encrypted',
      target: ['production'],
    })),
  );
  console.log(
    JSON.stringify({
      project: directory,
      origin: projects[directory].origin,
      configuredKeys: Object.keys(values),
    }),
  );
}
