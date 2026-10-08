import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GroupError } from './service.js';

const feature = z.object({
  geometry: z.object({
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  properties: z.object({
    name: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
});
export function parsePlaces(data: unknown) {
  const result = z.object({ features: z.array(feature) }).parse(data);
  return result.features
    .filter(({ geometry, properties: p }) => {
      const lon = geometry.coordinates[0];
      const lat = geometry.coordinates[1];
      if (!p.name && !p.street && !p.city) return false;
      // Strict Ethiopia Coordinate Bounding Box (Long 32.9..48.0, Lat 3.3..15.0)
      const inEthiopiaBounds = lon >= 32.9 && lon <= 48.0 && lat >= 3.3 && lat <= 15.0;
      const matchesCountry = !p.country || p.country.toLowerCase().includes('ethiopia');
      return inEthiopiaBounds && matchesCountry;
    })
    .slice(0, 6)
    .map(({ geometry, properties: p }) => ({
      name: [...new Set([p.name, p.street, p.city, p.state, p.country].filter(Boolean))]
        .join(', ')
        .slice(0, 300),
      longitude: geometry.coordinates[0],
      latitude: geometry.coordinates[1],
    }));
}

// Explicit searches only: bounded cache and one upstream request per second per API process.
export async function placeRoutes(app: FastifyInstance) {
  const cache = new Map<string, { expires: number; places: ReturnType<typeof parsePlaces> }>();
  let nextRequest = 0;
  app.post('/places/search', async (req, reply) => {
    const { query } = z
      .object({ query: z.string().trim().min(2).max(150) })
      .strict()
      .parse(req.body);
    const key = query.toLocaleLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return { places: cached.places };
    if (Date.now() < nextRequest) {
      reply.header('Retry-After', '1');
      throw new GroupError('Please wait a moment before searching again.', 429);
    }
    nextRequest = Date.now() + 1000;
    const url = new URL(process.env.PHOTON_URL ?? 'https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    // Ground search strictly to Ethiopia bounding box & Addis Ababa center bias
    url.searchParams.set('bbox', '32.9,3.3,48.0,15.0');
    url.searchParams.set('lat', '9.01');
    url.searchParams.set('lon', '38.77');
    url.searchParams.set('limit', '10');
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Zew-Ride-Demo/0.1', Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Provider unavailable');
      const places = parsePlaces(await response.json());
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 86400000, places });
      return { places };
    } catch {
      return reply.code(503).send({
        message:
          'Place search is temporarily unavailable. Try again, use device location, or set a pin on the map.',
      });
    }
  });
}
