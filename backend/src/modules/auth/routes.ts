import type { FastifyInstance } from 'fastify';
import type { Store } from '../../shared/store.js';
import { verifyIdentity as defaultVerifier, type IdentityVerifier } from './service.js';

export async function authRoutes(
  app: FastifyInstance,
  { store, verifyIdentity = defaultVerifier }: { store: Store; verifyIdentity?: IdentityVerifier },
) {
  // Passwords and email confirmation belong to the identity provider.
  for (const path of ['/api/v1/auth/login', '/api/v1/auth/signup']) {
    app.post(path, async (_, reply) =>
      reply.code(410).send({
        message: 'Use verified email sign-in. Local password accounts are no longer supported.',
      }),
    );
  }
  app.post('/api/v1/auth/session', async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || token.length > 8192)
      return reply.code(401).send({ message: 'Sign in to continue.' });
    const identity = await verifyIdentity(token);
    if (!identity) return reply.code(401).send({ message: 'Your sign-in could not be verified.' });
    if (!identity.emailConfirmed)
      return reply.code(403).send({ message: 'Confirm your email before signing in.' });
    // Self-selected provider metadata never grants driver or operator permissions.
    const user = { id: identity.id, email: identity.email, name: identity.name, role: 'rider' };
    return reply.code(201).send(store.createSessionForUser(user));
  });
  app.get('/api/v1/auth/me', async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const id = token.length === 64 ? store.session(token) : undefined;
    if (!id) return reply.code(401).send({ message: 'Sign in to continue.' });
    const state = store.read(id);
    if (!state.user) return reply.code(401).send({ message: 'This is a private guest session.' });
    return { user: state.user };
  });
  app.post('/api/v1/auth/logout', async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (token.length === 64) store.revoke(token);
    return reply.code(204).send();
  });
}
