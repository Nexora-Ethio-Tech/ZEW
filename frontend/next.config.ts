import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const configuredApi = process.env.API_URL;
if (process.env.VERCEL && !configuredApi) {
  throw new Error(
    'Set API_URL to your persistent HTTPS backend origin before deploying to Vercel.',
  );
}
const api = new URL(configuredApi || 'http://127.0.0.1:4000');
if (
  !['http:', 'https:'].includes(api.protocol) ||
  api.username ||
  api.password ||
  api.pathname !== '/' ||
  api.search ||
  api.hash
) {
  throw new Error(
    'API_URL must be an HTTP(S) origin without credentials, a path, or query parameters.',
  );
}
if (
  process.env.VERCEL &&
  (api.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(api.hostname))
) {
  throw new Error(
    'Vercel requires a public HTTPS API_URL; localhost cannot host the persistent backend.',
  );
}
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: resolve(process.cwd()) },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  async redirects() {
    return ['/ride', '/rides', '/demo'].map((source) => ({
      source,
      destination: '/planned',
      permanent: true,
    }));
  },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${api.origin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default config;
