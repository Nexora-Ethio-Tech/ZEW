import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app.js';
import { PostgresStore } from '../src/shared/postgres-store.js';
import { env } from '../src/config/env.js';
if (!env.DATABASE_URL) throw new Error('Configure DATABASE_URL before deploying the API.');
const app = buildApp({ store: new PostgresStore(env.DATABASE_URL), logger: true });
let ready: Promise<unknown> | undefined;
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  ready ??= Promise.resolve(app.ready()).catch((error) => {
    ready = undefined;
    throw error;
  });
  await ready;
  app.server.emit('request', request, response);
}
