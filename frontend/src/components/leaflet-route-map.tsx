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
    const instance = L.map(node.current, { scrollWheelZoom: false }).setView([9.01, 38.77], 13);
    map.current = instance;
    L.tileLayer(
      process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    )
      .on('tileerror', () => setTileError(true))
      .addTo(instance);
    layers.current = L.layerGroup().addTo(instance);

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layers.current || !corridor) return;
    layers.current.clearLayers();

    const originIdx = corridor.stops.findIndex((s) => s.id === originId);
    const destIdx = corridor.stops.findIndex((s) => s.id === destinationId);
    if (originIdx === -1 || destIdx === -1) return;

    const reverse = originIdx > destIdx;
    const startIndex = Math.min(originIdx, destIdx);
    const endIndex = Math.max(originIdx, destIdx);

    // Draw the full corridor line lightly
    const allLatLngs = corridor.stops.map((s) => [s.latitude, s.longitude] as [number, number]);
    L.polyline(allLatLngs, {
      color: '#d4dfc7',
      weight: 6,
      opacity: 0.6,
    }).addTo(layers.current);

    // Draw the active route segment bolder
    const activeStops = corridor.stops.slice(startIndex, endIndex + 1);
    const activeLatLngs = activeStops.map((s) => [s.latitude, s.longitude] as [number, number]);
    L.polyline(activeLatLngs, {
      color: '#285943',
      weight: 6,
      opacity: 0.9,
    }).addTo(layers.current);

    // Draw markers for origin and destination
    const origin = corridor.stops[originIdx];
    const destination = corridor.stops[destIdx];

    for (const [place, letter, color] of [
      [origin, 'A', '#456b38'],
      [destination, 'B', '#c77742'],
    ] as const) {
      const label = document.createElement('span');
      label.textContent = `${letter === 'A' ? 'Pickup' : 'Drop-off'}: ${place.name}`;
      L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({
          className: 'street-pin',
          html: `<span style="background:${color}">${letter}</span>`,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
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

    map.current.fitBounds(allLatLngs, { padding: [30, 30] });
  }, [corridor, originId, destinationId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={node} className="street-map" style={{ borderRadius: '12px' }} />
      {tileError && (
        <p role="status" className="map-load-error">
          Some map tiles could not load. Check your connection.
        </p>
      )}
    </div>
  );
}
