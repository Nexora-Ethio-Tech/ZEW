import { useState } from 'react';
import { usePassengerAccount } from '../auth/passenger-access';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { Avatar } from './avatar';
import { money, type Pool } from './types';

export type PoolDialog = 'how' | 'fare' | 'location' | 'account';
export function PoolHelp({
  modal,
  pool,
  close,
}: {
  modal: PoolDialog;
  pool?: Pool;
  close: () => void;
}) {
  const account = usePassengerAccount();
  const [accountError, setAccountError] = useState('');
  const titles = {
    how: 'A circle that goes your way.',
    fare: 'Small group. Smaller share.',
    location: 'Your location, your choice.',
    account: 'Your private workspace',
  };
  return (
    <Modal title={titles[modal]} close={close}>
      <div className="pool-modal-content">
        {modal === 'fare' ? (
          <>
            <p>
              The trip total is divided equally between the people in your circle. The projected 10%
              platform fee is included. No payment is collected.
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
              Matching chooses compatible applications when you apply and locks that group's share.
              Shorter drop-offs use the same split. Any rounding remainder goes to the lead rider.
            </p>
            <small>
              Custom destinations use a {pool?.quote.total ?? 'fixed'} ETB projected total
              regardless of distance. This is not a road-based quote.
            </small>
          </>
        ) : modal === 'location' ? (
          <>
            <p>
              Search for a place, confirm a map pin, or tap “Use my location” for a single GPS
              reading. Background tracking is never enabled.
            </p>
            <p>
              Your pickup is saved in your private session. Selecting a manual pickup removes the
              device reading. GPS needs accuracy within 100 metres and a fresh reading within two
              minutes.
            </p>
            <p>
              Search text is sent to Photon. Map tiles share the viewed area with the configured
              tile provider (OpenStreetMap by default). GPS coordinates are not sent for reverse
              geocoding.
            </p>
            <small>
              Road times and rider profiles are not live. A nearby map pin does not establish safe,
              legal, or reachable pickups.
            </small>
          </>
        ) : modal === 'account' ? (
          <>
            <div className="account-summary">
              <Avatar name={account?.name ?? 'You'} size={58} />
              <div>
                <h3>{account?.name ?? 'A little space of your own.'}</h3>
                <p>{account?.email ?? 'Saved in your private guest session.'}</p>
              </div>
            </div>
            <p>
              {account
                ? 'Your ride records belong to your account. Sign in again to access them on another device.'
                : 'Your rides survive refreshes in this browser. Guest access expires after 30 days; clearing browser data loses access to this workspace.'}
            </p>
            {accountError && <p role="alert">{accountError}</p>}
            <div
              className="account-actions"
              style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}
            >
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
                    setAccountError('Could not sign out. Please try again.');
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
                'Choose a group size and fare limit. Matching selects eligible applications.',
              ],
              [
                'Try the whole journey.',
                'Request your circle, review the driver side, then start and complete the journey. Your record appears in My rides.',
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
              Matching checks the entire pickup span, driver arrival, seats, direction, and rider
              readiness. Use Refresh availability to restart the two-minute window.
            </p>
            <small>Preview records are staged. Live transport and payment are not connected.</small>
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
        <span className="pool-demo-badge">RIDE RECORDS</span>
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
              · {ride.id.startsWith('demo-history-') ? 'Preview record' : 'Completed ride'}
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
                    <dt>Projected driver payout</dt>
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
          <p>Completed rides will appear here.</p>
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
