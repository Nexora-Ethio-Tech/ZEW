import { Icon } from '@/components/icon';
import { day, time, type Booking, type Commute } from '@/lib/api';
export function RideRecords({
  bookings,
  filter,
  setFilter,
  busy,
  stopName,
  refresh,
  cancel,
}: {
  bookings: Booking[];
  filter: 'upcoming' | 'past';
  setFilter: (value: 'upcoming' | 'past') => void;
  busy: boolean;
  stopName: (id: string) => string;
  refresh: () => void;
  cancel: (id: string) => void;
}) {
  const active = bookings.filter((b) => ['confirmed', 'in_progress'].includes(b.status));
  const visible =
    filter === 'upcoming'
      ? active
      : bookings.filter((b) => ['completed', 'cancelled'].includes(b.status));
  return (
    <>
      <div className="content-toolbar">
        <div className="tabs">
          <button
            className={filter === 'upcoming' ? 'active' : ''}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming <span>{active.length}</span>
          </button>
          <button className={filter === 'past' ? 'active' : ''} onClick={() => setFilter('past')}>
            Past rides
          </button>
        </div>
        <button className="text-button" disabled={busy} onClick={refresh}>
          Refresh
        </button>
      </div>
      {!visible.length && (
        <div className="empty-inline">
          <Icon name="rides" size={30} />
          <p>
            {filter === 'upcoming'
              ? 'No upcoming reservations. Plan a ride to get started.'
              : 'Completed and cancelled rides will appear here.'}
          </p>
        </div>
      )}
      <div className="booking-list">
        {visible.map((b) => (
          <article key={b.id} className="card booking-card">
            <div className="section-title">
              <span className={`status-pill ${b.status}`}>
                {b.status === 'confirmed'
                  ? b.boardingVerified
                    ? 'Boarded · waiting to depart'
                    : b.driverAccepted
                      ? 'Driver accepted'
                      : 'Waiting for driver'
                  : { in_progress: 'On the way', completed: 'Completed', cancelled: 'Cancelled' }[
                      b.status
                    ]}
              </span>
              <span className="muted">
                {day(b.departure)} · {time(b.departure)} EAT
              </span>
            </div>
            <h2>
              {stopName(b.origin)} <span className="route-arrow">→</span> {stopName(b.destination)}
            </h2>
            <p>
              {b.driver} · {b.vehicle} · {b.seats} {b.seats === 1 ? 'seat' : 'seats'}
            </p>
            <div className="booking-bottom">
              {b.status === 'confirmed' && !b.boardingVerified ? (
                <div className="boarding-code">
                  <small>YOUR BOARDING CODE</small>
                  <strong>{b.code}</strong>
                  <span>Show this 4-digit code to your driver when boarding.</span>
                </div>
              ) : (
                <p>
                  {b.boardingVerified && b.status === 'confirmed'
                    ? 'Boarding confirmed. Your driver is checking the remaining passengers.'
                    : b.status === 'completed'
                      ? 'No payment was processed or charged.'
                      : b.status === 'in_progress'
                        ? 'Your journey is in progress.'
                        : 'Your reservation was cancelled.'}
                </p>
              )}
              <div className="booking-fare">
                <strong>{b.fare} ETB</strong>
                <small>Total fare</small>
              </div>
            </div>
            {b.status === 'confirmed' && !b.boardingVerified && (
              <button className="danger-link" disabled={busy} onClick={() => cancel(b.id)}>
                Cancel reservation
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
export function SavedCommutes({
  commutes,
  busy,
  stopName,
  add,
  use,
  remove,
}: {
  commutes: Commute[];
  busy: boolean;
  stopName: (id: string) => string;
  add: () => void;
  use: (commute: Commute) => void;
  remove: (id: string) => void;
}) {
  return (
    <>
      <div className="content-toolbar">
        <p className="muted">{commutes.length} of 10 commutes saved</p>
        <button className="secondary" onClick={add}>
          <Icon name="plus" size={17} /> Add a commute
        </button>
      </div>
      {!commutes.length && (
        <div className="empty-inline">
          <Icon name="bookmark" size={30} />
          <p>Save a route to plan your next commute faster.</p>
        </div>
      )}
      <div className="saved-grid">
        {commutes.map((c) => (
          <article className="card saved-card" key={c.id}>
            <span className="small-icon">
              <Icon name="bookmark" />
            </span>
            <h2>{c.name}</h2>
            <p>
              {stopName(c.origin)} → {stopName(c.destination)}
            </p>
            <small>
              {time(c.departure)} EAT · {c.seats} {c.seats === 1 ? 'seat' : 'seats'}
            </small>
            <div className="saved-actions">
              <button className="primary" onClick={() => use(c)}>
                Use this route
                <Icon name="arrow" size={16} />
              </button>
              <button className="text-button" disabled={busy} onClick={() => remove(c.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
