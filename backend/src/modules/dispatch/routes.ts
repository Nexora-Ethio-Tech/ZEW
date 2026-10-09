import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DataStore as Store } from '../../shared/data-store.js';
import { corridors } from '../trips/model.js';
import { demoRoutePlaces } from '../groups/model.js';

export async function dispatchRoutes(app: FastifyInstance, { store }: { store: Store }) {
  app.get('/driver/dashboard', async (req) => {
    const driver = await store.driver(req.sessionId);
    // Synchronize expiry in the same persisted passenger workspace before displaying a queue.
    for (const request of await store.listAssigned(req.sessionId)) {
      if (
        request.kind === 'circle' &&
        ['requested', 'accepted'].includes(request.status) &&
        (request.requestedUntil ?? 0) <= Date.now()
      )
        await store.mutateAssigned(req.sessionId, request.id, 'expire', () => null);
    }
    const requests = (await store.listAssigned(req.sessionId)).map((request) => {
      const stopPoint = corridors
        .flatMap((corridor) => corridor.stops)
        .find((stop) => stop.name.toLowerCase() === request.pickup.toLowerCase());
      const groupPoint = Object.values(demoRoutePlaces).find(
        (place) => place.name.toLowerCase() === request.pickup.toLowerCase(),
      );
      const destinationStop = corridors
        .flatMap((corridor) => corridor.stops)
        .find((stop) => stop.name.toLowerCase() === request.destination.toLowerCase());
      const groupDestination = Object.values(demoRoutePlaces).find(
        (place) => place.name.toLowerCase() === request.destination.toLowerCase(),
      );
      return {
        ...request,
        pickupPoint:
          request.pickupPoint ??
          (stopPoint
            ? {
                latitude: stopPoint.latitude,
                longitude: stopPoint.longitude,
                label: stopPoint.name,
              }
            : groupPoint
              ? {
                  latitude: groupPoint.latitude,
                  longitude: groupPoint.longitude,
                  label: groupPoint.name,
                }
              : undefined),
        destinationPoint:
          request.destinationPoint ??
          (destinationStop
            ? {
                latitude: destinationStop.latitude,
                longitude: destinationStop.longitude,
                label: destinationStop.name,
              }
            : groupDestination
              ? {
                  latitude: groupDestination.latitude,
                  longitude: groupDestination.longitude,
                  label: groupDestination.name,
                }
              : undefined),
      };
    });
    const demand = new Map<
      string,
      {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        pickupCount: number;
        destinationCount: number;
      }
    >();
    for (const request of requests) {
      if (!['requested', 'accepted'].includes(request.status) || request.boardingVerified) continue;
      for (const [point, kind] of [
        [request.pickupPoint, 'pickup'],
        [request.destinationPoint, 'destination'],
      ] as const) {
        if (!point) continue;
        const key = `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;
        const item = demand.get(key) ?? {
          id: key,
          name: point.label,
          latitude: point.latitude,
          longitude: point.longitude,
          pickupCount: 0,
          destinationCount: 0,
        };
        if (kind === 'pickup') item.pickupCount += request.seats;
        else item.destinationCount += request.seats;
        demand.set(key, item);
      }
    }
    return {
      driver,
      requests,
      demandPoints: [...demand.values()],
      earnings: await store.earnings(req.sessionId),
    };
  });
  app.post('/driver/departures/:id/start', async (req) => {
    const { id } = z.object({ id: z.string().regex(/^[a-f0-9-]{32,36}$/) }).parse(req.params);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return store.startDeparture(req.sessionId, id);
  });
  app.post('/driver/requests/:id/action', async (req) => {
    await store.driver(req.sessionId);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const input = z
      .object({
        action: z.enum(['accept', 'decline', 'start', 'complete']),
        code: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      })
      .strict()
      .parse(req.body);
    return store.performDriverAction(req.sessionId, id, input.action, input.code);
  });
}
