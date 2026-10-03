'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from './types';

export default function StreetMap({
  pickup,
  destination,
  disabled,
  choose,
}: {
  pickup: Place;
  destination: Place;
  disabled: boolean;
  choose: (target: 'pickup' | 'destination', place: Place) => Promise<boolean>;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const [target, setTarget] = useState<'pickup' | 'destination' | null>(null);
  const [pin, setPin] = useState<Place | null>(null);
  const [tileError, setTileError] = useState(false);
  const current = useRef({ target, disabled });
  current.current = { target, disabled };
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
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!current.current.target || current.current.disabled) return;
      const latitude = Math.max(-90, Math.min(90, event.latlng.lat));
      const longitude = ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180;
      setPin({
        name: `Map pin (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
        latitude,
        longitude,
      });
    });
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
    if (!map.current || !layers.current) return;
    layers.current.clearLayers();
    for (const [place, letter, color] of [
      [pickup, 'A', '#456b38'],
      [destination, 'B', '#c77742'],
    ] as const) {
      const label = document.createElement('span');
      label.textContent = `${letter === 'A' ? 'Pickup' : 'Destination'}: ${place.name}`;
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
    map.current.fitBounds(
      [
        [pickup.latitude, pickup.longitude],
        [destination.latitude, destination.longitude],
      ],
      { padding: [45, 45], maxZoom: 15 },
    );
    setPin(null);
    setTarget(null);
  }, [
    pickup.latitude,
    pickup.longitude,
    pickup.name,
    destination.latitude,
    destination.longitude,
    destination.name,
  ]);
  useEffect(() => {
    if (!pin || !map.current) return;
    const marker = L.circleMarker([pin.latitude, pin.longitude], {
      radius: 10,
      color: '#b46935',
      fillOpacity: 0.6,
    }).addTo(map.current);
    return () => {
      marker.remove();
    };
  }, [pin]);
  return (
    <>
      <div className="map-picker-toolbar">
        <button
          disabled={disabled}
          aria-pressed={target === 'pickup'}
          onClick={() => {
            setTarget('pickup');
            setPin(null);
          }}
        >
          Set pickup on map
        </button>
        <button
          disabled={disabled}
          aria-pressed={target === 'destination'}
          onClick={() => {
            setTarget('destination');
            setPin(null);
          }}
        >
          Set destination on map
        </button>
        <span>
          {target ? `Tap the map to choose your ${target}.` : 'Drag to explore · use + / − to zoom'}
        </span>
      </div>
      <div ref={node} className="street-map" />
      {pin && target && (
        <div className="map-pin-confirm">
          <span>{pin.name}</span>
          <button
            disabled={disabled}
            onClick={async () => {
              if (await choose(target, pin)) {
                setPin(null);
                setTarget(null);
              }
            }}
          >
            Confirm {target}
          </button>
          <button
            onClick={() => {
              setPin(null);
              setTarget(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {tileError && (
        <p role="status" className="map-load-error">
          Some map tiles could not load. Check your connection; place search and saved locations
          still work.
        </p>
      )}
    </>
  );
}
