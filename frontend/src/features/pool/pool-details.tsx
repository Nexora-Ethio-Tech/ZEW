import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Avatar } from './avatar';
import { duration, money, type Pool } from './types';

export type PoolDialog = 'how' | 'fare' | 'location' | 'account';
export function PoolHelp({
  modal,
  pool,
  close,
  driverView,
}: {
  modal: PoolDialog;
  pool?: Pool;
  close: () => void;
  driverView: () => void;
}) {
  const titles = {
    how: 'A circle that goes your way.',
    fare: 'Small group. Smaller share.',
    location: 'Your location, your choice.',
    account: 'Your private demo workspace',
  };
  return (
    <Modal title={titles[modal]} close={close}>
      <div className="pool-modal-content">
        {modal === 'fare' ? (
          <>
            <p>
              The demo divides a fixed trip total equally between the people in your circle. The
              proposed 10% platform fee is already included. No payment is collected.
            </p>
            <div className="fare-example">
              {pool?.fareOptions.map((option) => (
                <div key={option.seats}>
                  <span>
                    {option.seats} {option.seats === 1 ? 'rider' : 'riders'}
                  </span>
                  <strong>
                    {money(option.yourFare)}
                    <small> ETB / you</small>
                  </strong>
                </div>
              ))}
            </div>
            <p>
              The API chooses compatible sample riders when you apply and locks that group's share.
              Shorter drop-offs use the same split. Any rounding remainder goes to the lead rider.
            </p>
            <small>
              Custom destinations use a 360 ETB example total regardless of distance. This is not a
              road-based quote.
            </small>
          </>
        ) : modal === 'location' ? (
          <>
            <p>
              Search for a place, confirm a map pin, or tap “Use my location” for a single GPS
              reading. Background tracking is never enabled.
            </p>
            <p>
              Your pickup is saved in your private demo session. Selecting a manual pickup removes
              the device reading. GPS needs accuracy within 100 metres and a fresh reading within
              two minutes.
            </p>
            <p>
              Search text is sent to Photon. Map tiles share the viewed area with the configured
              tile provider (OpenStreetMap by default). GPS coordinates are not sent for reverse
              geocoding.
            </p>
            <small>
              Road times and riders are fictional. A nearby map pin does not establish safe, legal,
              or reachable pickups.
            </small>
          </>
        ) : modal === 'account' ? (
          <>
            <div className="account-summary">
              <Avatar name="You" size={58} />
              <div>
                <h3>A little space of your own.</h3>
                <p>Saved in this browser’s private demo.</p>
              </div>
            </div>
            <p>
              Your rides and selected places survive refreshes and API restarts. Other demo sessions
              cannot see them. Sessions expire after 30 days; clearing browser data loses access to
              this workspace.
            </p>
            <p>
              Driver space lets you simulate the other side of your own request. There is no real
              identity verification, dispatch, or payment account connected.
            </p>
            <div
              className="account-actions"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}
            >
              <button className="pool-secondary" onClick={driverView}>
                <Icon name="car" size={17} /> Explore driver space
              </button>
              <button
                type="button"
                className="pool-secondary logout-btn"
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={async () => {
                  try {
                    const { signOut } = await import('@/lib/auth');
                    await signOut();
                  } catch {
                    alert('Could not sign out. Please try again.');
                    return;
                  }
                  localStorage.removeItem('zew-demo-session');
                  window.location.href = '/';
                }}
              >
                <Icon name="close" size={15} /> Log out & return home
              </button>
            </div>
          </>
        ) : (
          <>
            {[
              [
                'Choose your journey.',
                'Search any pickup and destination, confirm a map pin, or use a one-time device location.',
              ],
              [
                'Make a little circle.',
                'Choose a group size to fill eligible demo seats, or add and remove individual riders. Review your share before requesting.',
              ],
              [
                'Try the whole journey.',
                'Request your circle, accept it in Driver space, then start and complete the demo. Your receipt appears in My rides.',
              ],
            ].map(([title, text], index) => (
              <div className="how-step" key={title}>
                <b>0{index + 1}</b>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <p className="two-minute-explanation">
              The demo checks the entire pickup span, driver arrival, seats, direction, and rider
              readiness. Use Refresh demo to restart the two-minute availability window.
            </p>
            <small>
              All profiles, consent, travel times, and driver responses are simulated. This is not a
              live transport service.
            </small>
          </>
        )}
        <button className="pool-primary" onClick={close}>
          Got it <Icon name="check" size={16} />
        </button>
      </div>
    </Modal>
  );
}

export function RideHistory({ pool, discover }: { pool: Pool; discover: () => void }) {
  return (
    <section className="pool-history">
      <div className="pool-section-heading">
        <h2>Your shared journeys</h2>
        <span className="pool-demo-badge">DEMO RECEIPTS</span>
      </div>
      <p className="section-description">A record of your circles. No money has been charged.</p>
      {pool.history.map((ride, index) => (
        <article key={ride.id} className="pool-history-card">
          <span className={`history-icon history-tone-${index % 2}`}>
            <Icon name="route" size={25} />
          </span>
          <div>
            <span className="history-date">
              {new Date(ride.date).toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Africa/Addis_Ababa',
              })}{' '}
              · {ride.id.startsWith('demo-history-') ? 'Seeded example' : 'Completed demo'}
            </span>
            <h3>{ride.route}</h3>
            <p>
              <Icon name="people" size={13} />
              {ride.members} {ride.members === 1 ? 'person' : 'people'} · No charge
            </p>
            {ride.total !== undefined && (
              <details className="receipt-details">
                <summary>View receipt</summary>
                <dl>
                  <div>
                    <dt>Trip total</dt>
                    <dd>{money(ride.total)} ETB</dd>
                  </div>
                  <div>
                    <dt>Included platform fee</dt>
                    <dd>{money(ride.fee ?? 0)} ETB</dd>
                  </div>
                  <div>
                    <dt>Simulated driver payout</dt>
                    <dd>{money(ride.driverPayout ?? 0)} ETB</dd>
                  </div>
                </dl>
              </details>
            )}
          </div>
          <strong>
            {money(ride.fare)}
            <small>ETB / your share</small>
          </strong>
        </article>
      ))}
      {!pool.history.length && (
        <div className="pool-empty">
          <Icon name="rides" size={35} />
          <h3>Your first circle starts here.</h3>
          <p>Completed demo rides will appear here.</p>
        </div>
      )}
      <div className="history-note">
        <Icon name="leaf" size={25} />
        <p>
          Another way to go.<span>Your next shared journey starts with a circle.</span>
        </p>
        <button className="pool-secondary" onClick={discover}>
          Find your next circle <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

export function DriverSpace({
  pool,
  driverId,
  setDriverId,
  busy,
  now,
  action,
  discover,
}: {
  pool: Pool;
  driverId: string;
  setDriverId: (id: string) => void;
  busy: boolean;
  now: number;
  action: (path: string, body?: unknown) => Promise<boolean>;
  discover: () => void;
}) {
  const driver = pool.drivers.find((item) => item.id === driverId)!;
  const earnings = pool.driverEarnings.find((item) => item.driverId === driverId)!;
  return (
    <section className="pool-driver">
      <div className="pool-section-heading">
        <h2>The other side of your circle</h2>
        <span className="pool-demo-badge">SIMULATED DRIVER</span>
      </div>
      <p className="section-description">
        Try accepting your own request. Drivers, vehicles, and pickup times are fictional.
      </p>
      <div className="driver-identity">
        <Avatar name={driver.name} color="blue" size={58} />
        <div>
          <label htmlFor="demo-driver">CHOOSE A DEMO DRIVER</label>
          <select
            id="demo-driver"
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            {pool.drivers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.car}
              </option>
            ))}
          </select>
          <p>
            {driver.seats} passenger seats · {duration(driver.etaSeconds)} simulated arrival
          </p>
        </div>
      </div>
      <div className="driver-stat-grid">
        <div>
          <Icon name="rides" size={20} />
          <strong>
            {earnings.completedTrips} {earnings.completedTrips === 1 ? 'ride' : 'rides'}
          </strong>
          <span>Completed by this demo driver</span>
        </div>
        <div>
          <Icon name="wallet" size={20} />
          <strong>{money(earnings.payout)} ETB</strong>
          <span>Simulated payout · retained receipts</span>
        </div>
      </div>
      {['accepted', 'in_progress'].includes(pool.status) && pool.driverItinerary && (
        <article
          className="driver-manifest-card"
          style={{
            background: 'var(--surface-dark, #18181b)',
            color: '#fff',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#38bdf8',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              ACTIVE GROUP MANIFEST · {pool.driverItinerary.groupCode}
            </span>
            <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: '600' }}>
              Payout: {money(pool.driverItinerary.totalDriverPayout)} ETB
            </span>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
            Passenger Stops & Contact Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pool.driverItinerary.passengers.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', color: '#f4f4f5' }}>{p.name}</strong>
                  <div style={{ fontSize: '12px', color: '#a1a1aa' }}>📞 {p.phone}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                    📍 Pickup: {p.pickup} ➔ Drop-off: {p.destination}
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8' }}>
                  {money(p.fare)} ETB
                </span>
              </div>
            ))}
          </div>
        </article>
      )}
      {pool.status === 'requested' ? (
        <article className="group-call-card">
          <div className="group-call-heading">
            <span className="call-pulse" />
            <strong>Your circle is requesting a ride</strong>
            <span>{Math.max(0, Math.ceil(((pool.requestedUntil ?? 0) - now) / 1000))}s left</span>
          </div>
          <h3>
            {pool.pickupName}
            <Icon name="arrow" size={19} />
            {pool.mapDestination.name}
          </h3>
          <div className="group-call-people">
            <Avatar name="You" size={38} />
            {pool.riders
              .filter((rider) => rider.selected)
              .map((rider) => (
                <Avatar key={rider.id} name={rider.name} color={rider.color} size={38} />
              ))}
            <span>{pool.quote.count} passenger seats</span>
          </div>
          <div className="call-pricing">
            <span>
              Example group total<strong>{money(pool.quote.total)} ETB</strong>
            </span>
            <span>
              Simulated payout<strong>{money(pool.quote.driverPayout)} ETB</strong>
            </span>
          </div>
          {driver.issue && (
            <p className="driver-rejection">
              <Icon name="clock" size={16} />
              {driver.issue}
            </p>
          )}
          <button
            className="pool-primary"
            disabled={busy || !!driver.issue || (pool.requestedUntil ?? 0) <= now}
            onClick={async () => {
              if (await action('/accept', { groupId: pool.id, driverId })) discover();
            }}
          >
            Accept group request <Icon name="check" size={17} />
          </button>
          <p className="request-note">The API rechecks seats and the complete pickup window.</p>
        </article>
      ) : (
        <div className="pool-empty">
          <Icon name="car" size={38} />
          <h3>
            {['accepted', 'in_progress'].includes(pool.status)
              ? 'Your circle has a driver.'
              : 'Your next circle is waiting to happen.'}
          </h3>
          <p>
            {['accepted', 'in_progress'].includes(pool.status)
              ? 'Return to your circle to start or complete the demo ride.'
              : 'Build a circle and request it to try accepting it here.'}
          </p>
          <button className="pool-secondary" onClick={discover}>
            Back to my circle <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      <div className="driver-constraints">
        <Icon name="shield" />
        <div>
          <strong>Every pickup must fit.</strong>
          <p>
            The demo checks capacity, direction, readiness, and the final pickup within 120 seconds.
            Real road routing and payments are not connected.
          </p>
        </div>
      </div>
    </section>
  );
}
