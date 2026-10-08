'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { usePool } from './use-pool';
import { PlaceSearch } from './place-search';
import { FarePanel } from './fare-panel';
import { Avatar } from './avatar';
import { DriverSpace, PoolHelp, RideHistory, type PoolDialog } from './pool-details';
import { duration, money, type PoolRider } from './types';
import { TelebirrModal } from '../payments/telebirr-modal';
import { useEventStream } from '@/lib/use-event-stream';
import './pool.css';

const StreetMap = dynamic(() => import('./street-map'), {
  ssr: false,
  loading: () => (
    <div className="street-map-loading" role="status">
      Loading your map…
    </div>
  ),
});
type View = 'discover' | 'history' | 'driver';
const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'discover', label: 'Find your circle', icon: 'route' },
  { id: 'history', label: 'My rides', icon: 'rides' },
  { id: 'driver', label: 'Driver space', icon: 'car' },
];
const tiers = ['Solo', 'Pair', 'Trio', 'Full car'];
export function PoolWorkspace() {
  const searchParams = useSearchParams();
  const param = searchParams.get('view');
  const view: View = param === 'history' || param === 'driver' ? param : 'discover';
  const navigate = (next: View) => {
    const url = new URL(window.location.href);
    if (next === 'discover') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.pushState(null, '', url.pathname + url.search);
  };
  const {
    pool,
    busy: updating,
    error,
    locating,
    now,
    action,
    locate,
    start,
    setError,
    online,
    syncing,
    refresh,
  } = usePool();
  const busy = updating || locating || !online;
  const [filter, setFilter] = useState<'ready' | 'all'>('ready');
  const [modal, setModal] = useState<PoolDialog | null>(null);
  const [telebirrOpen, setTelebirrOpen] = useState(false);
  const [driverId, setDriverId] = useState('hana');
  const { isConnected: sseConnected } = useEventStream();
  const draft = pool?.status === 'draft';
  const ready =
    pool?.riders.filter(
      (rider) => !rider.issue && rider.readyUntil > now && !pool.skippedIds.includes(rider.id),
    ) ?? [];
  const members = pool?.riders.filter((rider) => rider.selected) ?? [];
  const visibleRiders =
    pool?.riders.filter(
      (rider) =>
        !pool.skippedIds.includes(rider.id) &&
        (rider.selected || (draft && (filter === 'all' || ready.includes(rider)))),
    ) ?? [];
  const step =
    !pool || draft
      ? 0
      : ['requested', 'accepted'].includes(pool.status)
        ? 1
        : pool.status === 'in_progress' || pool.status === 'completed'
          ? 2
          : 0;

  function memberCard(rider: PoolRider) {
    const travelling = rider.selected && ['in_progress', 'completed'].includes(pool!.status);
    const expired = !travelling && rider.readyUntil <= now;
    const issue = travelling ? null : expired ? 'Availability expired' : rider.issue;
    const full = pool!.quote.count === 4;
    return (
      <article
        key={rider.id}
        className={`neighbour-card ${rider.selected ? 'is-selected' : ''} ${issue ? 'is-unavailable' : ''}`}
      >
        <div className="neighbour-top">
          <Avatar name={rider.name} color={rider.color} size={44} />
          <div>
            <h3>{rider.name}</h3>
            <p>
              <Icon name="pin" size={12} />
              {pool!.destinations.find((destination) => destination.id === rider.destination)?.name}
            </p>
          </div>
          <span className={`pickup-time ${issue ? 'too-far' : ''}`} title="Simulated pickup time">
            <Icon name="clock" size={12} />
            {duration(rider.pickupSeconds)}
          </span>
        </div>
        <div className="neighbour-route">
          <span className="tiny-route" />
          <p>
            {rider.pickup}
            <small>
              {issue ||
                (rider.selected
                  ? 'In your circle · demo rider'
                  : 'Same demo direction · ready to share')}
            </small>
          </p>
        </div>
        {draft && !issue && !rider.selected && rider.yourFareIfAdded !== null && (
          <div className="neighbour-fare-preview">
            <span>Your share with {rider.name.split(' ')[0]}</span>
            <strong>
              {money(rider.yourFareIfAdded)} <small>ETB</small>
              <Icon name="leaf" size={12} />
            </strong>
          </div>
        )}
        <div className="neighbour-footer">
          <span className="readiness">
            <i className={issue ? 'not-ready' : ''} />
            {travelling
              ? 'Confirmed member'
              : expired
                ? 'Window ended'
                : `${Math.max(0, Math.ceil((rider.readyUntil - now) / 1000))}s availability`}
          </span>
          {rider.selected ? (
            <button
              className="remove-member"
              disabled={busy || !draft}
              aria-label={`Remove ${rider.name}`}
              onClick={() => void action('/members', { riderId: rider.id, action: 'remove' })}
            >
              <Icon name="check" size={14} /> Added {draft && <Icon name="close" size={12} />}
            </button>
          ) : (
            <div className="neighbour-actions">
              {!issue && (
                <button
                  className="skip-rider"
                  disabled={busy || !draft}
                  aria-label={`Skip ${rider.name}`}
                  onClick={() => void action('/members', { riderId: rider.id, action: 'skip' })}
                >
                  Skip
                </button>
              )}
              <button
                className="add-member"
                disabled={busy || !draft || !!issue || full}
                aria-label={`Add ${rider.name}`}
                onClick={() => void action('/members', { riderId: rider.id, action: 'add' })}
              >
                {issue ? 'Unavailable' : full ? 'Circle full' : 'Add to group'}
                {!issue && !full && <Icon name="plus" size={13} />}
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="pool-app">
      <a className="pool-skip-link" href="#main">
        Skip to your journey
      </a>
      <aside className="pool-sidebar">
        <Link href="/" className="pool-logo" aria-label="Zew home">
          zew<span>↗</span>
        </Link>
        <span className="pool-city">
          <i /> MADE FOR ADDIS
        </span>
        <nav aria-label="Main navigation">
          <p>LET’S GET GOING</p>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.id === 'history' && pool && (
                <span className="nav-number">{pool.history.length}</span>
              )}
            </button>
          ))}
          <div className="pool-nav-divider" />
          <Link href="/planned">
            <Icon name="bookmark" />
            Planned commutes
            <Icon name="chevron" size={14} />
          </Link>
        </nav>
        <div className="pool-sidebar-bottom">
          <div className="small-city-card">
            <div className="city-doodle" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <i>↗</i>
            </div>
            <h3>
              A little company.
              <br />A lighter fare.
            </h3>
            <p>Good things happen when we go together.</p>
            <button onClick={() => setModal('how')}>
              Meet Zew
              <Icon name="arrow" size={15} />
            </button>
          </div>
          <button className="pool-help" onClick={() => setModal('how')}>
            <Icon name="help" size={17} />
            How it works
          </button>
          <button className="pool-profile" onClick={() => setModal('account')}>
            <Avatar name="You" size={37} />
            <span>
              <strong>Your little corner</strong>
              <small>Private demo workspace</small>
            </span>
            <Icon name="chevron" size={15} />
          </button>
        </div>
      </aside>
      <div className="pool-main-shell">
        <header className="pool-topbar">
          <span>
            <Icon name="sun" size={17} /> Wherever you’re going, <em>go together.</em>
          </span>
          <div>
            <button className="top-help" aria-label="How Zew works" onClick={() => setModal('how')}>
              <Icon name="help" size={20} />
            </button>
            <button
              className="account-button"
              aria-label="Your demo account"
              onClick={() => setModal('account')}
            >
              <Avatar name="You" size={33} />
            </button>
          </div>
        </header>
        <main id="main" className="pool-main" tabIndex={-1}>
          <section className="pool-title-row">
            <div>
              <p className="pool-kicker">YOUR ROUTE. YOUR PEOPLE.</p>
              <h1>
                {view === 'discover' ? (
                  <>
                    Same way.
                    <br className="mobile-title-break" /> <span>Better together.</span>
                    <i className="title-spark" aria-hidden="true">
                      ✳
                    </i>
                  </>
                ) : view === 'history' ? (
                  <>
                    Little journeys.<span> Good memories.</span>
                  </>
                ) : (
                  <>
                    One circle.<span> A shared journey.</span>
                  </>
                )}
              </h1>
              <p className="pool-intro">
                {view === 'discover'
                  ? 'Start anywhere. Choose your people. See how a shared ride could feel.'
                  : view === 'history'
                    ? 'Your completed demo rides, with every share accounted for.'
                    : 'Explore the driver experience in your private demo.'}
              </p>
            </div>
            <div className="pool-title-sticker">
              <Icon name="leaf" size={24} />
              <span>
                A lighter fare.
                <br />A little company.
              </span>
            </div>
          </section>
          {!online && (
            <div className="pool-alert" role="status">
              <Icon name="help" size={18} />
              <span>
                You’re offline. Reconnect to update or request a ride. Your last group is shown
                below.
              </span>
            </div>
          )}
          {error && (
            <div className="pool-alert" role="alert">
              <Icon name="help" size={18} />
              <span>{error}</span>
              <button
                disabled={syncing || updating || !online}
                onClick={() => void (pool ? refresh() : start())}
              >
                Retry
              </button>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          {!pool ? (
            <section className="pool-loading" role="status">
              {!error && <span className="pool-loader" />}
              <h2>{error ? 'Let’s get you connected.' : 'Getting your circle ready…'}</h2>
              <p>
                {error
                  ? 'Your workspace will be here when the connection returns.'
                  : 'Opening your private demo workspace.'}
              </p>
            </section>
          ) : (
            <>
              {view === 'discover' && (
                <ol className="journey-steps" aria-label="Ride progress">
                  {['Build your circle', 'Meet your demo driver', 'Go together'].map(
                    (label, index) => (
                      <li
                        key={label}
                        className={index <= step ? 'current' : ''}
                        aria-current={index === step ? 'step' : undefined}
                      >
                        <span>
                          {index < step ? <Icon name="check" size={13} /> : `0${index + 1}`}
                        </span>
                        {label}
                      </li>
                    ),
                  )}
                </ol>
              )}
              <div className="pool-content-grid">
                <div className="pool-content-left">
                  {view === 'discover' && (
                    <>
                      <section className="journey-planner" aria-label="Choose your journey">
                        <div className="planner-heading">
                          <h2>Where are we going?</h2>
                          <span>{draft ? '01 / YOUR JOURNEY' : 'JOURNEY LOCKED'}</span>
                        </div>
                        <div className="pickup-bar">
                          <div className="pickup-field">
                            <span className="pickup-field-icon">A</span>
                            <div>
                              <PlaceSearch
                                target="pickup"
                                value={pool.pickupName}
                                disabled={busy || !draft}
                                choose={(place) => action('/place', { target: 'pickup', place })}
                              />
                            </div>
                          </div>
                          <span className="pickup-route-arrow">
                            <Icon name="arrow" size={17} />
                          </span>
                          <div className="pickup-field dropoff-field">
                            <span className="dropoff-letter">B</span>
                            <div>
                              <PlaceSearch
                                target="destination"
                                value={pool.mapDestination.name}
                                disabled={busy || !draft}
                                choose={(place) =>
                                  action('/place', { target: 'destination', place })
                                }
                              />
                            </div>
                          </div>
                        </div>
                        <div className="planner-actions">
                          <button
                            className="locate-button"
                            onClick={locate}
                            disabled={busy || !draft}
                          >
                            <Icon name="pin" size={15} />
                            {locating ? 'Locating…' : 'Use my location'}
                          </button>
                          <span>
                            {pool.locationSource === 'demo'
                              ? 'Example journey · choose any place'
                              : 'Search, then select a result to confirm'}
                          </span>
                          <button
                            className="privacy-button"
                            aria-label="Location privacy"
                            onClick={() => setModal('location')}
                          >
                            <Icon name="shield" size={15} />
                          </button>
                        </div>
                      </section>
                      {(pool.locationIssue || pool.locationSource === 'device') && (
                        <div className={`location-message ${pool.locationIssue ? 'outside' : ''}`}>
                          <Icon name="pin" size={15} />
                          <span>
                            {pool.locationIssue ||
                              `Device pickup selected · accuracy ±${Math.round(pool.location?.accuracy ?? 0)}m · refresh within 2 minutes.`}
                          </span>
                          <button onClick={() => setModal('location')}>Details</button>
                        </div>
                      )}
                      <StreetMap
                        pickup={pool.mapPickup}
                        destination={pool.mapDestination}
                        disabled={busy || !draft}
                        draft={draft}
                        choose={(target, place) => action('/place', { target, place })}
                      />
                      <section className="neighbours" id="nearby-riders">
                        <div className="neighbours-heading">
                          <div>
                            <p className="section-eyebrow">02 / AUTOMATED RIDE CIRCLE</p>
                            <h2>
                              {draft
                                ? 'System-Matched Ride Circle'
                                : 'Your people, your shared journey.'}
                            </h2>
                            <p>
                              {draft
                                ? 'The system automatically matches compatible passengers traveling your way based on your group size & fare preferences.'
                                : 'Your group and fare stay locked for this request.'}
                            </p>
                          </div>
                          <button
                            className="refresh-neighbours"
                            disabled={busy || !draft}
                            onClick={() => void action('/refresh')}
                            title="Restart fictional availability for two minutes"
                          >
                            <Icon name="clock" size={14} />
                            Refresh demo
                          </button>
                        </div>
                        <div className="fare-tier-grid" aria-label="Choose circle size">
                          {pool.fareOptions.map((option) => (
                            <button
                              key={option.seats}
                              id={`fare-tier-${option.seats}`}
                              className={`fare-tier-card ${pool.quote.count === option.seats ? 'is-active' : ''}`}
                              aria-pressed={pool.quote.count === option.seats}
                              disabled={busy || !draft || !!option.issue}
                              title={option.issue ?? `Build a ${option.seats}-person circle`}
                              onClick={() =>
                                void action('/preference', { targetSeats: option.seats })
                              }
                            >
                              <span className="tier-people" aria-hidden="true">
                                {Array.from({ length: option.seats }, (_, index) => (
                                  <i key={index} />
                                ))}
                              </span>
                              <strong className="tier-label">{tiers[option.seats - 1]}</strong>
                              <span className="tier-sublabel">
                                {option.seats === 1 ? 'Just you' : `You + ${option.seats - 1}`}
                              </span>
                              <span className="tier-fare">
                                <strong>{money(option.yourFare)}</strong>
                                <small> ETB / you</small>
                              </span>
                              <span className="tier-availability">
                                {option.issue
                                  ? 'Unavailable now'
                                  : pool.quote.count === option.seats
                                    ? 'Your current circle'
                                    : 'Fill these seats'}
                              </span>
                            </button>
                          ))}
                        </div>
                        {draft && (
                          <div className="neighbour-filters" aria-label="Filter demo riders">
                            <button
                              className={filter === 'ready' ? 'active' : ''}
                              aria-pressed={filter === 'ready'}
                              onClick={() => setFilter('ready')}
                            >
                              Ready to share <span>{ready.length}</span>
                            </button>
                            <button
                              className={filter === 'all' ? 'active' : ''}
                              aria-pressed={filter === 'all'}
                              onClick={() => setFilter('all')}
                            >
                              All demo riders
                            </button>
                            <span>FICTIONAL PROFILES</span>
                          </div>
                        )}
                        <div className="neighbour-grid">{visibleRiders.map(memberCard)}</div>
                        {!visibleRiders.length && (
                          <div className="pool-empty">
                            <Icon name="people" size={32} />
                            <h3>
                              {draft ? 'A fresh circle is one tap away.' : 'Just you this time.'}
                            </h3>
                            <p>
                              {draft
                                ? 'The demo availability window has ended. Refresh to bring riders back, or request a solo ride.'
                                : 'Your solo demo request is ready in the fare panel.'}
                            </p>
                            {draft && (
                              <button
                                className="pool-secondary"
                                disabled={busy}
                                onClick={() => void action('/refresh')}
                              >
                                Refresh availability <Icon name="arrow" size={16} />
                              </button>
                            )}
                          </div>
                        )}
                        {pool.skippedIds.length > 0 && (
                          <p className="skipped-message">
                            {pool.skippedIds.length}{' '}
                            {pool.skippedIds.length === 1 ? 'rider' : 'riders'} skipped. Refresh
                            demo to show them again.
                          </p>
                        )}
                        <div className="pickup-limit-note">
                          <span>
                            02<span>MIN</span>
                          </span>
                          <p>
                            Close by, in the demo.
                            <small>
                              Pickup windows are simulated. Actual roads and safe boarding points
                              still need verification.
                            </small>
                          </p>
                          <Icon name="clock" size={24} />
                        </div>
                      </section>
                    </>
                  )}
                  {view === 'history' && (
                    <RideHistory pool={pool} discover={() => navigate('discover')} />
                  )}
                  {view === 'driver' && (
                    <DriverSpace
                      pool={pool}
                      driverId={driverId}
                      setDriverId={setDriverId}
                      busy={busy}
                      now={now}
                      action={action}
                      discover={() => navigate('discover')}
                    />
                  )}
                </div>
                <FarePanel
                  pool={pool}
                  busy={busy}
                  now={now}
                  action={action}
                  driverView={() => navigate('driver')}
                  explain={() => setModal('fare')}
                  onTelebirrPay={() => setTelebirrOpen(true)}
                />
              </div>
            </>
          )}
          <footer className="pool-footer">
            <span>
              Built for the way Addis moves.
              <Icon name="leaf" size={12} />
            </span>
            <div>
              <span>Demo riders · No real payments</span>
              <button onClick={() => setModal('how')}>How it works</button>
              <button onClick={() => setModal('location')}>Your location</button>
            </div>
          </footer>
        </main>
      </div>
      {pool && (
        <div className="pool-mobile-summary">
          <div>
            <small>
              {1 + members.length} {members.length ? 'people' : 'person'} in your circle
            </small>
            <strong>
              {money(pool.lockedFare ?? pool.quote.yourFare)} <span>ETB / you</span>
            </strong>
          </div>
          <button
            onClick={() =>
              document
                .querySelector('.group-card')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            View my group
            <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      {modal && (
        <PoolHelp
          modal={modal}
          pool={pool}
          close={() => setModal(null)}
          driverView={() => {
            setModal(null);
            navigate('driver');
          }}
        />
      )}
      {pool && (
        <TelebirrModal
          isOpen={telebirrOpen}
          onClose={() => setTelebirrOpen(false)}
          groupId={pool.id}
          amount={pool.lockedFare ?? pool.quote.yourFare}
          routeLabel={pool.destinations.find((d) => d.id === pool.destination)?.name ?? 'Zew Route'}
          onSuccess={() => {
            void action('/refresh');
          }}
        />
      )}
    </div>
  );
}
