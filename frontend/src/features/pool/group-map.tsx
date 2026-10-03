'use client';
import dynamic from 'next/dynamic';
import type { Pool, Place } from './types';
const StreetMap = dynamic(() => import('./street-map'), {
  ssr: false,
  loading: () => <div className="street-map-loading">Loading street map…</div>,
});

export function GroupMap({
  pool,
  disabled,
  choose,
}: {
  pool: Pool;
  disabled: boolean;
  choose: (target: 'pickup' | 'destination', place: Place) => Promise<boolean>;
}) {
  return (
    <section className="real-map-card" aria-label="Interactive street map">
      <div className="real-map-heading">
        <strong>Your journey, anywhere.</strong>
        <span>OPENSTREETMAP</span>
      </div>
      <StreetMap
        pickup={pool.mapPickup}
        destination={pool.mapDestination}
        disabled={disabled}
        choose={choose}
      />
      <p className="real-map-note">
        Real streets & selected locations. No road route or live riders shown yet; pickup times
        below are simulated.
      </p>
    </section>
  );
}
