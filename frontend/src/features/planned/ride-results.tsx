import { Icon } from '@/components/icon';
import { day, time, type Trip } from '@/lib/api';
export function RideResults({
  trips,
  busy,
  choose,
  profile,
}: {
  trips: Trip[];
  busy: boolean;
  choose: (trip: Trip) => void;
  profile: (trip: Trip) => void;
}) {
  return (
    <section className="results-section" aria-live="polite">
      <div className="section-title">
        <h2>
          {trips.length ? `${trips.length} rides going your way` : 'No rides for this route yet'}
        </h2>
        <span className="muted">Within 30 minutes of your departure</span>
      </div>
      {trips.length ? (
        <div className="match-list">
          {trips.map((trip, index) => (
            <article className="match-card card" key={trip.id}>
              <button
                type="button"
                className="driver-profile-trigger planned-profile-trigger"
                onClick={() => profile(trip)}
                aria-label={`View ${trip.driver}'s listing`}
              >
                <span className={`avatar driver-avatar tone-${index}`}>{trip.driver[0]}</span>
                <span className="driver-details">
                  <strong>
                    {trip.driver} <span className="sample-label">Preview listing</span>
                  </strong>
                  <span>{trip.vehicle}</span>
                  <small>
                    <Icon name="route" size={13} /> Same direction · {trip.availableSeats} seats
                    left
                  </small>
                </span>
              </button>
              <div className="match-time">
                <strong>{time(trip.departure)}</strong>
                <span>{day(trip.departure)}</span>
              </div>
              <div className="match-price">
                <strong>
                  {trip.fare}
                  <small> ETB</small>
                </strong>
                <span>per seat</span>
              </div>
              <button className="primary" disabled={busy} onClick={() => choose(trip)}>
                Choose ride
                <Icon name="arrow" size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-inline">
          <Icon name="route" size={30} />
          <p>Try a different time, fewer seats, or another corridor.</p>
        </div>
      )}
    </section>
  );
}
