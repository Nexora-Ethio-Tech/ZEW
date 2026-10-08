import type { FastifyReply } from 'fastify';

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
      message: 'Zew live SSE driver & status stream connected',
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

  const baseLat = 8.9982;
  const baseLng = 38.7865;

  const drivers = [
    {
      id: 'hana',
      name: 'Hana T.',
      car: 'Toyota Vitz',
      plate: 'DEMO 2048',
      latitude: baseLat + Math.sin(driverTickAngle) * 0.003,
      longitude: baseLng + Math.cos(driverTickAngle) * 0.004,
      etaSeconds: Math.max(15, Math.round(20 + Math.sin(driverTickAngle) * 10)),
    },
    {
      id: 'dawit',
      name: 'Dawit M.',
      car: 'Suzuki Dzire',
      plate: 'DEMO 3061',
      latitude: baseLat + 0.005 + Math.cos(driverTickAngle * 0.8) * 0.002,
      longitude: baseLng - 0.003 + Math.sin(driverTickAngle * 0.8) * 0.003,
      etaSeconds: Math.max(25, Math.round(45 + Math.cos(driverTickAngle) * 15)),
    },
  ];

  broadcastEvent('global', {
    type: 'driver_tick',
    data: { drivers, timestamp: Date.now() },
  });
}, 4000);

// Idle simulation must not keep tests or a shutting-down API alive.
driverTimer.unref();
