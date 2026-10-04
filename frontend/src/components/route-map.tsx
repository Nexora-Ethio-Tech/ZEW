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
}: {
  corridor?: Corridor;
  originId: string;
  destinationId: string;
}) {
  return (
    <div className="route-map" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="map-caption" style={{ zIndex: 10 }}>
        <span className="live-dot" /> Explore your corridor{' '}
        <span className="map-chip">ADDIS ABABA</span>
      </div>
      <div style={{ flex: 1, minHeight: '300px', width: '100%' }}>
        <LeafletRouteMap corridor={corridor} originId={originId} destinationId={destinationId} />
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
