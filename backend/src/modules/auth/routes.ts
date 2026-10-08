import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Store } from '../../shared/store.js';

export async function authRoutes(app: FastifyInstance, { store }: { store: Store }) {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { email, password } = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const user = store.findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({ message: 'Invalid email or password.' });
    }

    const hash = store.hashPassword(password);
    if (user.passwordHash !== hash) {
      return reply.status(401).send({ message: 'Invalid email or password.' });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const authSession = store.createSessionForUser(userPayload);
    return reply.status(200).send(authSession);
  });

  app.post('/api/v1/auth/signup', async (req, reply) => {
    const input = z
      .object({
        email: z.string().trim().email(),
        name: z.string().trim().min(2).max(100),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['rider', 'driver', 'operator']).optional().default('rider'),
      })
      .parse(req.body);

    try {
      const createdUser = store.createUser(input);
      const userPayload = {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
      };

      const authSession = store.createSessionForUser(userPayload);
      return reply.status(201).send(authSession);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Could not create account.' });
    }
  });

  app.get('/api/v1/auth/me', async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    const sessionId = token.length === 64 ? store.session(token) : undefined;
    if (!sessionId) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    const state = store.read(sessionId) as any;
    if (!state.user) {
      return reply.status(401).send({ message: 'Guest session' });
    }

    return reply.status(200).send({ user: state.user });
  });
}
