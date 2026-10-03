import { buildApp } from './app.js';
import { env } from './config/env.js';
const app = buildApp({ databasePath: env.DATABASE_PATH, logger: true });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
await app.listen({ port: env.PORT, host: env.HOST });
