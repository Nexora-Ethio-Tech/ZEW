'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Corridor } from '@/lib/api';

export default function LeafletRouteMap({
  corridor,
  originId,
  destinationId,
}: {
  corridor?: Corridor;
  originId: string;
  destinationId: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!node.current) return;

    // Fix default Leaflet icon paths in Next.js
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: '/map/marker-icon.png',
      iconRetinaUrl: '/map/marker-icon-2x.png',
      shadowUrl: '/map/marker-shadow.png',
    });

    const instance = L.map(node.current, {
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([9.01, 38.77], 13);
    map.current = instance;

    const isDark =
      typeof document !== 'undefined' &&
      (document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark-theme'));

    const defaultTileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? defaultTileUrl;
    const tileAttribution =
      process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: tileAttribution,
    });

    tileLayer.on('tileerror', () => setTileError(true));
    tileLayer.on('tileload', () => setTileError(false));

    tileLayer.addTo(instance);
    layers.current = L.layerGroup().addTo(instance);

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(node.current);

    const t1 = setTimeout(() => instance.invalidateSize(), 100);
    const t2 = setTimeout(() => instance.invalidateSize(), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      instance.stop();
      instance.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layers.current || !corridor) return;
    layers.current.clearLayers();

    const isDark =
      typeof document !== 'undefined' &&
      (document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark-theme'));

    const originIdx = corridor.stops.findIndex((s) => s.id === originId);
    const destIdx = corridor.stops.findIndex((s) => s.id === destinationId);
    if (originIdx === -1 || destIdx === -1) return;

    const reverse = originIdx > destIdx;
    const startIndex = Math.min(originIdx, destIdx);
    const endIndex = Math.max(originIdx, destIdx);

    // Draw the full corridor line lightly
    const allLatLngs = corridor.stops.map((s) => [s.latitude, s.longitude] as [number, number]);
    L.polyline(allLatLngs, {
      color: isDark ? '#334155' : '#d4dfc7',
      weight: 6,
      opacity: 0.6,
    }).addTo(layers.current);

    // Draw the active route segment bolder
    const activeStops = corridor.stops.slice(startIndex, endIndex + 1);
    const activeLatLngs = activeStops.map((s) => [s.latitude, s.longitude] as [number, number]);
    L.polyline(activeLatLngs, {
      color: isDark ? '#10b981' : '#285943',
      weight: 6,
      opacity: 0.9,
    }).addTo(layers.current);

    // Draw markers for origin and destination
    const origin = corridor.stops[originIdx];
    const destination = corridor.stops[destIdx];

    for (const [place, letter] of [
      [origin, 'A'],
      [destination, 'B'],
    ] as const) {
      const isPickup = letter === 'A';

      const label = document.createElement('span');
      label.textContent = `${isPickup ? 'Pickup' : 'Drop-off'}: ${place.name}`;

      const svgHtml = `
        <div class="raindrop-pin-wrapper raindrop-pin-${letter.toLowerCase()}">
          <svg class="raindrop-svg" viewBox="0 0 36 50" width="36" height="50">
            <defs>
              <linearGradient id="grad-${letter.toLowerCase()}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${isPickup ? '#34d399' : '#f87171'}" />
                <stop offset="100%" stop-color="${isPickup ? '#059669' : '#dc2626'}" />
              </linearGradient>
              <filter id="shadow-${letter.toLowerCase()}" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
              </filter>
            </defs>
            <path d="M 18 48 C 12 36, 2 28, 2 18 A 16 16 0 1 1 34 18 C 34 28, 24 36, 18 48 Z"
                  fill="url(#grad-${letter.toLowerCase()})"
                  stroke="#ffffff"
                  stroke-width="2.5"
                  filter="url(#shadow-${letter.toLowerCase()})" />
            <circle cx="18" cy="18" r="9" fill="#ffffff" />
            <text x="18" y="22.5" font-size="12" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" fill="${isPickup ? '#047857' : '#991b1b'}">${letter}</text>
          </svg>
          <div class="raindrop-shadow-pulse"></div>
        </div>
      `;

      L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({
          className: `street-pin street-pin-${letter.toLowerCase()}`,
          html: svgHtml,
          iconSize: [36, 70],
          iconAnchor: [18, 50],
        }),
      })
        .bindPopup(label)
        .addTo(layers.current);
    }

    // Add small dots for intermediate stops
    if (activeStops.length > 2) {
      for (let i = 1; i < activeStops.length - 1; i++) {
        const stop = activeStops[i];
        L.circleMarker([stop.latitude, stop.longitude], {
          radius: 4,
          color: '#285943',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
        }).addTo(layers.current);
      }
    }

    map.current.fitBounds(allLatLngs, { padding: [30, 30], animate: false });
  }, [corridor, originId, destinationId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%' }}>
      <div
        ref={node}
        className="street-map"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '100%',
          overflow: 'hidden',
          zIndex: 1,
        }}
      />
      {tileError && (
        <p role="status" className="map-load-error">
          Some map tiles could not load. Check your connection.
        </p>
      )}
    </div>
  );
}
