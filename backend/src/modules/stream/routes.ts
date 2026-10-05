import type { FastifyPluginAsync } from 'fastify';
import { registerStreamClient } from './service.js';

export const streamRoutes: FastifyPluginAsync = async (api) => {
  api.get('/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    registerStreamClient(req.sessionId, reply);

    // Keep connection alive indefinitely until client closes
    return reply;
  });
};
