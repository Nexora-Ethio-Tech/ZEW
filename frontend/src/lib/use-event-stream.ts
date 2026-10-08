import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from './api';

export interface DriverTick {
  id: string;
  name: string;
  car: string;
  plate: string;
  latitude: number;
  longitude: number;
  etaSeconds: number;
}
export function useEventStream(
  onDriverTick?: (drivers: DriverTick[]) => void,
  onPaymentUpdate?: (data: unknown) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [liveDrivers, setLiveDrivers] = useState<DriverTick[]>([]);
  const callbacks = useRef({ onDriverTick, onPaymentUpdate });
  callbacks.current = { onDriverTick, onPaymentUpdate };
  useEffect(() => {
    const controller = new AbortController();
    async function connect() {
      try {
        const token = await getAuthToken();
        const response = await fetch('/api/v1/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        setIsConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
              const event = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const type = event
                .split('\n')
                .find((line) => line.startsWith('event: '))
                ?.slice(7);
              const data = event
                .split('\n')
                .filter((line) => line.startsWith('data: '))
                .map((line) => line.slice(6))
                .join('\n');
              if (!data) continue;
              try {
                const payload = JSON.parse(data);
                if (type === 'driver_tick' && Array.isArray(payload.drivers)) {
                  setLiveDrivers(payload.drivers);
                  callbacks.current.onDriverTick?.(payload.drivers);
                } else if (type === 'payment_update') callbacks.current.onPaymentUpdate?.(payload);
              } catch {
                /* Ignore malformed simulation events. */
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch {
        /* UI shows the disconnected state; never place tokens in URLs. */
      } finally {
        if (!controller.signal.aborted) setIsConnected(false);
      }
    }
    void connect();
    return () => controller.abort();
  }, []);
  return { isConnected, liveDrivers };
}
