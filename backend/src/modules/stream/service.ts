import type { FastifyReply } from 'fastify';
import { demoDrivers, pickupZones } from '../groups/model.js';

export interface StreamEvent {
  type:
    | 'driver_tick'
    | 'group_update'
    | 'booking_update'
    | 'payment_update'
    | 'payment_completed'
    | 'heartbeat';
  data: Record<string, any>;
}

interface ClientConnection {
  sessionId: string;
  reply: FastifyReply;
  joinedAt: number;
}

const activeClients = new Set<ClientConnection>();

export function registerStreamClient(sessionId: string, reply: FastifyReply) {
  const connection: ClientConnection = {
    sessionId,
    reply,
    joinedAt: Date.now(),
  };

  activeClients.add(connection);

  // Send SSE initial connection event
  sendSseMessage(connection, {
    type: 'heartbeat',
    data: {
      message: 'Zew status stream connected',
      connectedAt: new Date().toISOString(),
    },
  });

  reply.raw.on('close', () => {
    activeClients.delete(connection);
  });
}

function sendSseMessage(client: ClientConnection, event: StreamEvent) {
  try {
    client.reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  } catch {
    activeClients.delete(client);
  }
}

export function broadcastEvent(targetSessionId: string | 'global', event: StreamEvent) {
  for (const client of activeClients) {
    if (targetSessionId === 'global' || client.sessionId === targetSessionId) {
      sendSseMessage(client, event);
    }
  }
}

// Background radar driver ticks simulator (moves drivers along Bole / CMC corridor coordinates)
let driverTickAngle = 0;
const driverTimer = setInterval(() => {
  if (activeClients.size === 0) return;
  driverTickAngle = (driverTickAngle + 0.05) % (2 * Math.PI);

  const origin = pickupZones[0];
  const drivers = demoDrivers.slice(0, 2).map((driver, index) => ({
    id: driver.id,
    name: driver.name,
    car: driver.car,
    plate: driver.plate,
    latitude: origin.latitude + index * 0.005 + Math.sin(driverTickAngle) * 0.003,
    longitude: origin.longitude - index * 0.003 + Math.cos(driverTickAngle) * 0.004,
    etaSeconds: Math.max(15, Math.round(driver.etaSeconds + Math.sin(driverTickAngle) * 10)),
  }));

  broadcastEvent('global', {
    type: 'driver_tick',
    data: { drivers, timestamp: Date.now() },
  });
}, 4000);

// Idle simulation must not keep tests or a shutting-down API alive.
driverTimer.unref();
