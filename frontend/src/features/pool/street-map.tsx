'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '@/components/icon';
import type { Place } from './types';

type Target = 'pickup' | 'destination';
export default function StreetMap({
  pickup,
  destination,
  disabled,
  draft = true,
  choose,
}: {
  pickup: Place;
  destination: Place;
  disabled: boolean;
  draft?: boolean;
  choose: (target: Target, place: Place) => Promise<boolean>;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const preview = useRef<L.CircleMarker | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [pin, setPin] = useState<Place | null>(null);
  const [tileError, setTileError] = useState(false);
  const selection = useRef({ target, disabled });
  selection.current = { target, disabled };

  useEffect(() => {
    if (!node.current) return;

    // Fix default Leaflet icon paths in Next.js
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const instance = L.map(node.current, { scrollWheelZoom: false }).setView([9.005, 38.773], 14);
    map.current = instance;

    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL ??
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileAttribution =
      process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: tileAttribution,
    });

    tileLayer.on('tileerror', () => {
      // Fallback to Esri World Street Map if OSM rate-limited
      tileLayer.setUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      );
    });

    tileLayer.addTo(instance);
    markers.current = L.layerGroup().addTo(instance);

    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (!selection.current.target || selection.current.disabled) return;
      const longitude = event.latlng.wrap().lng;
      setPin({
        name: `Map pin (${event.latlng.lat.toFixed(5)}, ${longitude.toFixed(5)})`,
        latitude: event.latlng.lat,
        longitude,
      });
    });

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(node.current);

    const t1 = setTimeout(() => instance.invalidateSize(), 100);
    const t2 = setTimeout(() => instance.invalidateSize(), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    for (const [place, letter, color, targetKey] of [
      [pickup, 'A', '#1c4d36', 'pickup'],
      [destination, 'B', '#b96742', 'destination'],
    ] as const) {
      const label = document.createElement('div');
      label.className = 'map-marker-popup';
      label.innerHTML = `<strong>${letter === 'A' ? 'Pickup (Start)' : 'Destination (End)'}</strong><br/>${place.name}<br/><small style="color:#666">Drag pin to reposition</small>`;

      const marker = L.marker([place.latitude, place.longitude], {
        title: `${letter === 'A' ? 'Pickup' : 'Destination'}: ${place.name}`,
        draggable: !disabled && draft,
        icon: L.divIcon({
          className: `street-pin street-pin-${letter.toLowerCase()}`,
          html: `<span style="background:${color}; cursor:grab;">${letter}</span>`,
          iconSize: [36, 44],
          iconAnchor: [18, 44],
        }),
      })
        .bindPopup(label)
        .addTo(markers.current);

      marker.on('dragend', async (e: L.LeafletEvent) => {
        const dragMarker = e.target as L.Marker;
        const pos = dragMarker.getLatLng().wrap();
        const newPlace: Place = {
          name: `Map pin (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`,
          latitude: pos.lat,
          longitude: pos.lng,
        };
        await choose(targetKey, newPlace);
      });
    }
    map.current.fitBounds(
      [
        [pickup.latitude, pickup.longitude],
        [destination.latitude, destination.longitude],
      ],
      { padding: [60, 60], maxZoom: 15 },
    );
  }, [
    pickup.latitude,
    pickup.longitude,
    pickup.name,
    destination.latitude,
    destination.longitude,
    destination.name,
    disabled,
    draft,
    choose,
  ]);

  useEffect(() => {
    preview.current?.remove();
    if (pin && map.current)
      preview.current = L.circleMarker([pin.latitude, pin.longitude], {
        radius: 10,
        color: '#315941',
        fillColor: '#dfeebc',
        fillOpacity: 1,
      }).addTo(map.current);
    return () => {
      preview.current?.remove();
    };
  }, [pin]);
  useEffect(() => {
    if (disabled) {
      setTarget(null);
      setPin(null);
    }
  }, [disabled]);

  return (
    <section className="real-map-card" aria-label="Journey map">
      <div className="real-map-heading">
        <strong>
          <Icon name="pin" size={16} /> Your journey, on the map
        </strong>
        <span>REAL STREETS · DEMO RIDES</span>
      </div>
      <div
        ref={node}
        className="street-map"
        style={{
          position: 'relative',
          width: '100%',
          height: '350px',
          minHeight: '350px',
          background: '#e7ecde',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 1,
        }}
        aria-label="Street map. Use arrow keys to pan, plus and minus to zoom."
      />
      {tileError && (
        <p role="status" className="map-load-error">
          Map tiles couldn’t load. Place search and your selected locations still work.
        </p>
      )}
      <div className="map-picker-toolbar">
        {(['pickup', 'destination'] as const).map((value) => (
          <button
            key={value}
            disabled={disabled}
            aria-pressed={target === value}
            onClick={() => {
              setTarget(target === value ? null : value);
              setPin(null);
            }}
          >
            <Icon name="pin" size={14} /> Set {value} on map
          </button>
        ))}
        <span>
          A · Pickup <i /> B · Destination
        </span>
      </div>
      {target && (
        <div className="map-pin-confirm" role="status">
          <span>
            {pin
              ? `Confirm this ${target}?`
              : `Tap the map to choose your ${target}, or pan and use its centre.`}
          </span>
          {pin ? (
            <button
              disabled={disabled}
              onClick={async () => {
                if (await choose(target, pin)) {
                  setTarget(null);
                  setPin(null);
                }
              }}
            >
              Confirm {target}
            </button>
          ) : (
            <button
              disabled={disabled}
              onClick={() => {
                const center = map.current?.getCenter().wrap();
                if (center)
                  setPin({
                    name: `Map pin (${center.lat.toFixed(5)}, ${center.lng.toFixed(5)})`,
                    latitude: center.lat,
                    longitude: center.lng,
                  });
              }}
            >
              Use map centre
            </button>
          )}
          <button
            onClick={() => {
              setTarget(null);
              setPin(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <p className="real-map-note">
        Selected places only. Road routing and live pickup times are not connected.
      </p>
    </section>
  );
}
