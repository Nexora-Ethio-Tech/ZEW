import { useEffect, useState } from 'react';
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

export function useEventStream(onDriverTick?: (drivers: DriverTick[]) => void, onPaymentUpdate?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [liveDrivers, setLiveDrivers] = useState<DriverTick[]>([]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isCancelled = false;

    getAuthToken()
      .then((token) => {
        if (isCancelled) return;
        eventSource = new EventSource(`/api/v1/stream?token=${token}`);

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.addEventListener('driver_tick', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed.drivers) {
              setLiveDrivers(parsed.drivers);
              onDriverTick?.(parsed.drivers);
            }
          } catch {
            // Ignore parse errors
          }
        });

        eventSource.addEventListener('payment_update', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            onPaymentUpdate?.(parsed);
          } catch {
            // Ignore parse errors
          }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
        };
      })
      .catch(() => {
        setIsConnected(false);
      });

    return () => {
      isCancelled = true;
      eventSource?.close();
    };
  }, []);

  return { isConnected, liveDrivers };
}
