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
  const [collapsed, setCollapsed] = useState(!draft);
  const selection = useRef({ target, disabled });
  selection.current = { target, disabled };

  // Sync collapsed state when draft changes (auto-collapse after finding/requesting ride)
  useEffect(() => {
    if (!draft) {
      setCollapsed(true);
    }
  }, [draft]);

  useEffect(() => {
    if (!node.current) return;

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
    }).setView([9.005, 38.773], 14);
    map.current = instance;

    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileAttribution =
      process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: tileAttribution,
    });

    tileLayer.on('tileerror', () => setTileError(true));
    tileLayer.on('tileload', () => setTileError(false));

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
      instance.stop();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    for (const [place, letter, targetKey] of [
      [pickup, 'A', 'pickup'],
      [destination, 'B', 'destination'],
    ] as const) {
      const isPickup = letter === 'A';

      const label = document.createElement('div');
      label.className = 'map-marker-popup';
      const heading = document.createElement('strong');
      heading.textContent = isPickup ? 'Pickup (Start)' : 'Destination (End)';
      const hint = document.createElement('small');
      hint.textContent = 'Drag the pin to move';
      label.append(
        heading,
        document.createElement('br'),
        document.createTextNode(place.name),
        document.createElement('br'),
        hint,
      );

      const svgHtml = `
        <div class="raindrop-pin-wrapper raindrop-pin-${letter.toLowerCase()}">
          <svg class="raindrop-svg" viewBox="0 0 36 50" width="36" height="50">
            <defs>
              <linearGradient id="grad-${letter.toLowerCase()}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${isPickup ? '#34d399' : '#fb923c'}" />
                <stop offset="100%" stop-color="${isPickup ? '#059669' : '#ea580c'}" />
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
            <text x="18" y="22.5" font-size="12" font-weight="900" font-family="system-ui, sans-serif" text-anchor="middle" fill="${isPickup ? '#047857' : '#c2410c'}">${letter}</text>
          </svg>
          <div class="raindrop-shadow-pulse"></div>
        </div>
      `;

      const marker = L.marker([place.latitude, place.longitude], {
        title: `${isPickup ? 'Pickup' : 'Destination'}: ${place.name}`,
        draggable: !disabled && draft,
        icon: L.divIcon({
          className: `street-pin street-pin-${letter.toLowerCase()}`,
          html: svgHtml,
          iconSize: [36, 70],
          iconAnchor: [18, 50],
        }),
      })
        .bindPopup(label)
        .addTo(markers.current);

      marker.on('dragstart', () => {
        if (map.current) map.current.dragging.disable();
      });

      marker.on('dragend', async (e: L.LeafletEvent) => {
        if (map.current) map.current.dragging.enable();
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
      { padding: [50, 50], maxZoom: 15 },
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

  // Handle map resize & zoom fit when collapsed toggles
  useEffect(() => {
    if (!map.current) return;
    const timer = setTimeout(() => {
      map.current?.invalidateSize();
      map.current?.fitBounds(
        [
          [pickup.latitude, pickup.longitude],
          [destination.latitude, destination.longitude],
        ],
        { padding: [35, 35], maxZoom: 15 },
      );
    }, 320);
    return () => clearTimeout(timer);
  }, [collapsed, pickup, destination]);

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
    <section
      className={`real-map-card ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Journey map"
    >
      <div className="real-map-heading">
        <strong>
          <Icon name="pin" size={16} /> Your journey, on the map
        </strong>
        <span className="map-badge-tag">REAL STREETS</span>
      </div>
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          ref={node}
          className="street-map"
          style={{
            position: 'relative',
            width: '100%',
            height: collapsed ? '210px' : '420px',
            minHeight: collapsed ? '210px' : '420px',
            maxHeight: collapsed ? '210px' : '420px',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            background: '#e7ecde',
            overflow: 'hidden',
            zIndex: 1,
          }}
          aria-label="Street map. Drag A or B raindrop pins to move your route."
        />
        <div className="map-overlay-box bottom-right">
          <div className="legend-item pickup-legend">
            <i className="legend-dot green-dot" />{' '}
            <span>
              <strong>Green (A)</strong>: Pickup
            </span>
          </div>
          <div className="legend-item dest-legend">
            <i className="legend-dot red-dot" />{' '}
            <span>
              <strong>Red/Orange (B)</strong>: Destination
            </span>
          </div>
          <button
            type="button"
            className="map-collapse-btn-bordered"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand map' : 'Collapse map'}
          >
            {collapsed ? '🗺️ Expand map' : '📐 Collapse map'}
          </button>
        </div>
      </div>
      {tileError && (
        <p role="status" className="map-load-error">
          Map tiles couldn’t load. Place search and your selected locations still work.
        </p>
      )}
      {!collapsed && (
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
      )}
      {target && !collapsed && (
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
      {!collapsed && (
        <p className="real-map-note">
          Drag pins A (Pickup) or B (Destination) anytime to update your location.
        </p>
      )}
    </section>
  );
}
