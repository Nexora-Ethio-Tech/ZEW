'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Pool } from './types';

export function usePool() {
  const [pool, setPool] = useState<Pool>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const hasPool = useRef(false);
  const reading = useRef(false);
  const offset = useRef(0),
    inflight = useRef(false);
  const receive = useCallback((next: Pool) => {
    hasPool.current = true;
    offset.current = next.serverNow - Date.now();
    setPool((current) =>
      !current ||
      next.version > current.version ||
      (next.version === current.version && next.serverNow >= current.serverNow)
        ? next
        : current,
    );
    setNow(next.serverNow);
  }, []);
  const start = useCallback(async () => {
    if (reading.current || inflight.current) return;
    reading.current = true;
    setSyncing(true);
    try {
      setError('');
      const next = await api<Pool>('/pool/bootstrap', 'POST');
      setPool(next);
      receive(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your group.');
    } finally {
      reading.current = false;
      setSyncing(false);
    }
  }, [receive]);
  const refresh = useCallback(async () => {
    if (inflight.current || reading.current || !navigator.onLine) return;
    if (!hasPool.current) return start();
    reading.current = true;
    setSyncing(true);
    try {
      receive(await api<Pool>('/pool'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection lost.');
    } finally {
      reading.current = false;
      setSyncing(false);
    }
  }, [receive, start]);
  useEffect(() => {
    void start();
  }, [start]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const reconnect = () => {
      setOnline(true);
      void refresh();
    };
    const offline = () => setOnline(false);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    setOnline(navigator.onLine);
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  async function action(path: string, body?: unknown) {
    if (inflight.current) return false;
    if (!navigator.onLine) {
      setError('Reconnect before changing your circle. No ride actions are queued offline.');
      return false;
    }
    inflight.current = true;
    setBusy(true);
    setError('');
    try {
      receive(await api<Pool>(`/pool${path}`, 'POST', body));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      try {
        receive(await api<Pool>('/pool'));
      } catch {}
      return false;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function locate() {
    if (locating || busy) return;
    if (!navigator.geolocation || !window.isSecureContext) {
      setError(
        'Device location needs HTTPS or localhost. Search for a pickup or set a map pin instead.',
      );
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await action('/location', {
          source: 'device',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setLocating(false);
      },
      (e) => {
        setLocating(false);
        setError(
          e.code === 1
            ? 'Location permission was declined. Search for a pickup, set a map pin, or allow location in your browser and try again.'
            : e.code === 3
              ? 'Location took too long. Try again or search for a pickup.'
              : 'Your location is unavailable. Search for a pickup or set a map pin instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  return {
    pool,
    error,
    busy,
    locating,
    now,
    start,
    action,
    locate,
    setError,
    online,
    syncing,
    refresh,
  };
}
