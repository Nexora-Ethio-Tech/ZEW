import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { calculateRoadRoute } from './service.js';
import { env } from '../../config/env.js';

const coordSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const routeCalcSchema = z.object({
  origin: coordSchema,
  destination: coordSchema,
});

export const routingRoutes: FastifyPluginAsync = async (api) => {
  api.post('/routing/calculate', async (req, reply) => {
    const { origin, destination } = routeCalcSchema.parse(req.body);
    const result = await calculateRoadRoute(origin, destination, env.OSRM_URL);
    return reply.send(result);
  });
};
