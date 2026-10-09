import { buildApp } from './app.js';
import { PostgresStore } from './shared/postgres-store.js';
import { env } from './config/env.js';
if (process.env.VERCEL && !env.DATABASE_URL)
  throw new Error('Configure DATABASE_URL before deploying the API.');
const app = buildApp({
  databasePath: env.DATABASE_PATH,
  logger: true,
  ...(env.DATABASE_URL ? { store: new PostgresStore(env.DATABASE_URL) } : {}),
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
await app.listen({ port: env.PORT, host: env.HOST });
