import type { FastifyPluginAsync } from 'fastify';
import { registerStreamClient } from './service.js';

export const streamRoutes: FastifyPluginAsync = async (api) => {
  const replies = new Set<import('fastify').FastifyReply>();
  api.addHook('preClose', async () => {
    for (const reply of replies) reply.raw.end();
  });
  api.get('/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    replies.add(reply);
    reply.raw.once('close', () => replies.delete(reply));
    reply.hijack();
    registerStreamClient(req.sessionId, reply);

    // Keep connection alive indefinitely until client closes
    return reply;
  });
};
