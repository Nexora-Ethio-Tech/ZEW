'use client';

import dynamic from 'next/dynamic';
import { Icon } from './icon';
import type { Corridor, DemandPoint } from '@/lib/api';

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
  demandPoints,
  demandLabel,
  demandDescription,
  liveDemand,
}: {
  corridor?: Corridor;
  originId?: string;
  destinationId?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  demandPoints?: DemandPoint[];
  demandLabel?: string;
  demandDescription?: string;
  liveDemand?: boolean;
}) {
  return (
    <div
      className="route-map"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%' }}
    >
      <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
        <LeafletRouteMap
          corridor={corridor}
          originId={originId}
          destinationId={destinationId}
          demandPoints={demandPoints}
          liveDemand={liveDemand}
        />
        {onToggleCollapse && (
          <div className="map-overlay-box bottom-right">
            <button
              type="button"
              className="map-collapse-btn-bordered"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand map' : 'Collapse map'}
            >
              {collapsed ? '🗺️ Expand map' : '📐 Collapse map'}
            </button>
          </div>
        )}
      </div>
      <div className="map-bottom" style={{ zIndex: 10 }}>
        <div>
          <Icon name="route" />
          <span>
            <strong>{demandLabel ?? corridor?.name}</strong>
            <small>
              {demandLabel
                ? (demandDescription ??
                  'Green: pickups · red: destinations · simulated preview demand, not live traffic')
                : 'Illustrative stop order · not a road route'}
            </small>
          </span>
        </div>
        <span className="schematic">{demandLabel ? 'Assigned only' : 'Schematic corridor'}</span>
      </div>
    </div>
  );
}
