'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Pool } from './types';

export function usePool() {
  const [pool, setPool] = useState<Pool>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0),
    inflight = useRef(false);
  const receive = useCallback((next: Pool) => {
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
    try {
      setError('');
      receive(await api<Pool>('/pool/bootstrap', 'POST'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your group.');
    }
  }, [receive]);
  useEffect(() => {
    void start();
  }, [start]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const poll = setInterval(async () => {
      if (inflight.current || document.hidden) return;
      try {
        receive(await api<Pool>('/pool'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Connection lost.');
      }
    }, 15000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [receive]);
  async function action(path: string, body?: unknown) {
    if (inflight.current) return false;
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
  return { pool, error, busy, locating, now, start, action, locate, setError };
}
