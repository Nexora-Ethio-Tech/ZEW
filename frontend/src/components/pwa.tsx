'use client';
import { useEffect } from 'react';
export function Pwa() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* The online application remains usable without offline support. */
      });
    }
  }, []);
  return null;
}
