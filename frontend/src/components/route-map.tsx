'use client';

import dynamic from 'next/dynamic';
import { Icon } from './icon';
import type { Corridor } from '@/lib/api';

const LeafletRouteMap = dynamic(() => import('./leaflet-route-map'), {
  ssr: false,
  loading: () => <div className="street-map-loading">Loading interactive map…</div>,
});

export function RouteMap({
  corridor,
  originId,
  destinationId,
  collapsed,
  onToggleCollapse,
}: {
  corridor?: Corridor;
  originId: string;
  destinationId: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="route-map" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%' }}>
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <LeafletRouteMap corridor={corridor} originId={originId} destinationId={destinationId} />
        <div className="map-overlay-box bottom-right">
          <div className="legend-item pickup-legend">
            <i className="legend-dot green-dot" /> <span><strong>Green (A)</strong>: Pickup</span>
          </div>
          <div className="legend-item dest-legend">
            <i className="legend-dot red-dot" /> <span><strong>Red/Orange (B)</strong>: Destination</span>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              className="map-collapse-btn-bordered"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand map' : 'Collapse map'}
            >
              {collapsed ? '🗺️ Expand map' : '📐 Collapse map'}
            </button>
          )}
        </div>
      </div>
      <div className="map-bottom" style={{ zIndex: 10 }}>
        <div>
          <Icon name="route" />
          <span>
            <strong>{corridor?.name}</strong>
            <small>Illustrative stop order · not a road route</small>
          </span>
        </div>
        <span className="schematic">Demo corridor</span>
      </div>
    </div>
  );
}
