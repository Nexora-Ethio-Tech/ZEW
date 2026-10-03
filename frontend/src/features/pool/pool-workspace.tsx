'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { usePool } from './use-pool';
import { GroupMap } from './group-map';
import { PlaceSearch } from './place-search';
import { FarePanel } from './fare-panel';
import { Avatar } from './avatar';
import { duration, money, type PoolRider } from './types';
import './pool.css';

type View = 'discover' | 'history' | 'driver';
export function PoolWorkspace() {
  const { pool, busy: updating, error, locating, now, action, locate, start, setError } = usePool();
  const busy = updating || locating;
  const [view, setView] = useState<View>('discover');
  const [filter, setFilter] = useState<'ready' | 'all'>('ready');
  const [focused, setFocused] = useState<string | null>(null);
  const [modal, setModal] = useState<'how' | 'fare' | 'location' | null>(null);
  const [driverId, setDriverId] = useState('hana');
  const draft = pool?.status === 'draft';
  const ready =
    pool?.riders.filter((r) => !r.issue && r.readyUntil > now && !pool.skippedIds.includes(r.id)) ??
    [];
  const destination = pool?.destinations.find((d) => d.id === pool.destination);
  const selectedDriver = pool?.drivers.find((d) => d.id === driverId);
  const focus = (id: string) => {
    setFocused(id);
    setFilter('all');
    document
      .getElementById('nearby-riders')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  function memberCard(rider: PoolRider) {
    const selected = pool!.selectedIds.includes(rider.id);
    const travelling = selected && ['in_progress', 'completed'].includes(pool!.status);
    const expired = !travelling && rider.readyUntil <= now;
    const issue = travelling ? null : expired ? 'Availability expired' : rider.issue;
    const full = pool!.quote.count === 4;
    return (
      <article
        key={rider.id}
        className={`neighbour-card ${selected ? 'is-selected' : ''} ${focused === rider.id ? 'is-focused' : ''} ${issue ? 'is-unavailable' : ''}`}
      >
        <div className="neighbour-top">
          <Avatar name={rider.name} color={rider.color} size={48} />
          <div>
            <h3>
              {rider.name}
              <span className="demo-person-dot" title="Demo profile" />
            </h3>
            <p>
              <Icon name="pin" size={12} />
              {pool!.destinations.find((d) => d.id === rider.destination)?.name}
            </p>
          </div>
          <span className={`pickup-time ${issue ? 'too-far' : ''}`}>
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
                (selected
                  ? 'In your circle · demo consent confirmed'
                  : 'On your way · ready to share')}
            </small>
          </p>
        </div>
        {draft && !issue && !selected && rider.yourFareIfAdded !== null && (
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
                ? 'No longer waiting'
                : `${Math.max(0, Math.ceil((rider.readyUntil - now) / 1000))}s availability`}
          </span>
          {selected ? (
            <button
              className="remove-member"
              disabled={busy || !draft}
              aria-label={`Remove ${rider.name}`}
              onClick={() => void action('/members', { riderId: rider.id, action: 'remove' })}
            >
              <Icon name="check" size={14} /> Added <Icon name="close" size={12} />
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
                {issue ? 'Unavailable' : full ? 'Group full' : 'Add to group'}
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
      <aside className="pool-sidebar">
        <Link href="/" className="pool-logo" aria-label="Zew home">
          zew<span>↗</span>
        </Link>
        <span className="pool-city">
          <i /> MADE FOR ADDIS
        </span>
        <nav aria-label="Main navigation">
          <p>LET’S GET GOING</p>
          <button
            className={view === 'discover' ? 'active' : ''}
            onClick={() => setView('discover')}
          >
            <Icon name="route" />
            Find your circle<span className="nav-new">NEW</span>
          </button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
            <Icon name="rides" />
            My rides{pool && <span className="nav-number">{pool.history.length}</span>}
          </button>
          <Link href="/planned">
            <Icon name="bookmark" />
            Planned commutes
            <Icon name="chevron" size={14} />
          </Link>
          <div className="pool-nav-divider" />
          <button className={view === 'driver' ? 'active' : ''} onClick={() => setView('driver')}>
            <Icon name="car" />
            Driver space
          </button>
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
              Less traffic.
              <br />
              More together.
            </h3>
            <p>Your everyday ride can make a little difference.</p>
            <button onClick={() => setModal('how')}>
              Meet Zew
              <Icon name="arrow" size={15} />
            </button>
          </div>
          <button className="pool-help" onClick={() => setModal('how')}>
            <Icon name="help" size={17} />
            How it works
          </button>
          <div className="pool-profile">
            <Avatar name="You" size={37} />
            <span>
              <strong>Your little corner</strong>
              <small>Personal demo workspace</small>
            </span>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>
      <div className="pool-main-shell">
        <header className="pool-topbar">
          <span>
            <Icon name="sun" size={17} /> A good day to share a ride.
          </span>
          <div>
            <span className="pool-demo-badge">
              <i /> DEMO PLAYGROUND
            </span>
            <button className="top-help" aria-label="How Zew works" onClick={() => setModal('how')}>
              <Icon name="help" size={20} />
            </button>
            <Avatar name="You" size={33} />
          </div>
        </header>
        <main className="pool-main">
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
                    One group.<span> One easy pickup.</span>
                  </>
                )}
              </h1>
              <p className="pool-intro">
                {view === 'discover'
                  ? 'Start anywhere. Go anywhere. Find people going your way and share the fare.'
                  : view === 'history'
                    ? 'Your shared journeys, all in one little place.'
                    : 'Accept a ready group that fits your route, your seats, and a two-minute pickup.'}
              </p>
            </div>
            <div className="pool-title-sticker">
              <Icon name="leaf" size={24} />
              <span>
                A lighter fare.
                <br />A lighter city.
              </span>
            </div>
          </section>
          {error && (
            <div className="pool-alert" role="alert">
              <Icon name="help" size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <Icon name="close" size={15} />
              </button>
              {!pool && <button onClick={() => void start()}>Retry</button>}
            </div>
          )}
          {!pool ? (
            <section className="pool-loading">
              <span className="pool-loader" />
              <h2>Finding our way to you…</h2>
              <p>Getting your demo neighbourhood ready.</p>
            </section>
          ) : (
            <div className="pool-content-grid">
              <div className="pool-content-left">
                {view === 'discover' && (
                  <>
                    {pool.locationSource === 'demo' ? (
                      <section className="location-prompt-card">
                        <div className="location-prompt-icon">
                          <Icon name="pin" size={28} />
                        </div>
                        <h3>Where are you right now?</h3>
                        <p>
                          We'll use your phone's GPS as your exact pickup spot. We never track you
                          in the background.
                        </p>
                        <div className="location-prompt-actions">
                          <button
                            className="pool-primary"
                            onClick={locate}
                            disabled={busy || locating || !draft}
                          >
                            <Icon name="pin" size={16} />
                            {locating ? 'Locating…' : 'Share device location'}
                          </button>
                          <button
                            className="pool-secondary"
                            onClick={() => {
                              void action('/place', { target: 'pickup', place: pool.mapPickup });
                            }}
                            disabled={busy || !draft}
                          >
                            Search for a place
                          </button>
                        </div>
                      </section>
                    ) : (
                      <section className="pickup-bar">
                        <div className="pickup-field">
                          <span className="pickup-field-icon">
                            <Icon name="pin" size={19} />
                          </span>
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
                          <span className="dropoff-square" />
                          <div>
                            <PlaceSearch
                              target="destination"
                              value={destination?.name ?? ''}
                              disabled={busy || !draft}
                              choose={(place) => action('/place', { target: 'destination', place })}
                            />
                          </div>
                        </div>
                        <button
                          className="locate-button"
                          onClick={locate}
                          disabled={busy || locating || !draft}
                        >
                          <Icon name="pin" size={15} />
                          {locating ? 'Locating…' : 'Use my location'}
                        </button>
                      </section>
                    )}
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
                    <p className="place-privacy-note">
                      {pool.locationSource === 'demo' &&
                        'An example journey to get you started. Replace either place. '}
                      Search any street, landmark, or city. Search text is sent to Photon; map tiles
                      load from OpenStreetMap. Device location is optional.
                    </p>
                    <GroupMap
                      pool={pool}
                      disabled={busy || !draft}
                      choose={(target, place) => action('/place', { target, place })}
                    />
                    <div className="pool-map-footnote">
                      <Icon name="shield" size={14} />
                      <span>
                        Any pickup, any destination. Same-way & two-minute rules still apply.
                      </span>
                      <button onClick={() => setModal('how')}>
                        How matching works
                        <Icon name="arrow" size={12} />
                      </button>
                    </div>
                    <section className="neighbours" id="nearby-riders">
                      <div className="neighbours-heading">
                        <div>
                          <h2>How many do you want to share with?</h2>
                          <p>
                            Pick a fare that works for you. We'll auto-fill riders going your way.
                          </p>
                        </div>
                        <button
                          className="refresh-neighbours"
                          disabled={busy || !draft}
                          onClick={() => void action('/refresh')}
                          title="Restart the demo riders' availability window"
                        >
                          <Icon name="clock" size={14} />
                          Refresh demo
                        </button>
                      </div>
                      <div className="fare-tier-grid">
                        {[
                          { seats: 1, label: 'Solo', sublabel: 'Just you', icon: '👤' },
                          { seats: 2, label: 'Pair', sublabel: 'You + 1', icon: '👥' },
                          { seats: 3, label: 'Trio', sublabel: 'You + 2', icon: '🧑‍🤝‍🧑' },
                          { seats: 4, label: 'Full car', sublabel: 'You + 3', icon: '🚗' },
                        ].map(({ seats, label, sublabel, icon }) => {
                          const previewFare = (destination?.fare ?? 360) / seats;
                          const active = pool.targetSeats === seats;
                          return (
                            <button
                              key={seats}
                              id={`fare-tier-${seats}`}
                              className={`fare-tier-card ${active ? 'is-active' : ''}`}
                              disabled={busy || !draft}
                              onClick={() => void action('/preference', { targetSeats: seats })}
                            >
                              <span className="tier-icon">{icon}</span>
                              <strong className="tier-label">{label}</strong>
                              <span className="tier-sublabel">{sublabel}</span>
                              <span className="tier-fare">
                                <strong>{money(previewFare)}</strong>
                                <small> ETB / you</small>
                              </span>
                              {active && (
                                <span className="tier-active-tag">
                                  <Icon name="check" size={11} /> Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {pool.targetSeats > 1 && (
                        <>
                          <div className="neighbour-autofill-heading">
                            <Icon name="people" size={15} />
                            <span>
                              {pool.selectedIds.length > 0
                                ? `${pool.selectedIds.length} rider${pool.selectedIds.length > 1 ? 's' : ''} auto-filled for your circle`
                                : 'No eligible riders available right now — try refreshing.'}
                            </span>
                          </div>
                          <div className="neighbour-grid">
                            {pool.riders
                              .filter((r) => pool.selectedIds.includes(r.id))
                              .map((rider) => (
                                <article
                                  key={rider.id}
                                  className="neighbour-card is-selected is-autofilled"
                                >
                                  <div className="neighbour-top">
                                    <Avatar name={rider.name} color={rider.color} size={48} />
                                    <div>
                                      <h3>
                                        {rider.name}
                                        <span className="demo-person-dot" title="Demo profile" />
                                      </h3>
                                      <p>
                                        <Icon name="pin" size={12} />
                                        {
                                          pool.destinations.find((d) => d.id === rider.destination)
                                            ?.name
                                        }
                                      </p>
                                    </div>
                                    <span className="pickup-time">
                                      <Icon name="clock" size={12} />
                                      {duration(rider.pickupSeconds)}
                                    </span>
                                  </div>
                                  <div className="neighbour-route">
                                    <span className="tiny-route" />
                                    <p>
                                      {rider.pickup}
                                      <small>
                                        Auto-matched · On your way · demo consent confirmed
                                      </small>
                                    </p>
                                  </div>
                                  <div className="neighbour-footer autofill-footer">
                                    <span className="readiness">
                                      <i />
                                      {`${Math.max(0, Math.ceil((rider.readyUntil - now) / 1000))}s availability`}
                                    </span>
                                    <span className="autofill-badge">
                                      <Icon name="check" size={13} /> Auto-matched
                                    </span>
                                  </div>
                                </article>
                              ))}
                          </div>
                        </>
                      )}
                      {pool.skippedIds.length > 0 && (
                        <p className="skipped-message">
                          {pool.skippedIds.length} rider skipped. Refresh the demo to show them
                          again.
                        </p>
                      )}
                      <div className="pickup-limit-note">
                        <span>
                          02<span>MIN</span>
                        </span>
                        <p>
                          A little closer, a lot simpler.
                          <small>
                            Riders farther away or across the median won't be matched to your
                            circle.
                          </small>
                        </p>
                        <Icon name="shield" size={24} />
                      </div>
                    </section>
                  </>
                )}
                {view === 'history' && (
                  <section className="pool-history">
                    <div className="pool-section-heading">
                      <h2>Your shared journeys</h2>
                      <span className="pool-demo-badge">DEMO HISTORY</span>
                    </div>
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
                            · Shared ride
                          </span>
                          <h3>{ride.route}</h3>
                          <p>
                            <Icon name="people" size={13} />
                            {ride.members} people · Completed demo
                          </p>
                        </div>
                        <strong>
                          {money(ride.fare)}
                          <small>ETB / your share</small>
                        </strong>
                      </article>
                    ))}
                    <div className="history-note">
                      <Icon name="leaf" size={25} />
                      <p>
                        Good things add up.
                        <span>Your demo history includes two sample rides to explore.</span>
                      </p>
                      <button className="pool-secondary" onClick={() => setView('discover')}>
                        Find your next circle
                        <Icon name="arrow" size={16} />
                      </button>
                    </div>
                  </section>
                )}
                {view === 'driver' && (
                  <section className="pool-driver">
                    <div className="pool-section-heading">
                      <h2>Your driver workspace</h2>
                      <span className="pool-demo-badge">DRIVER SIMULATOR</span>
                    </div>
                    <div className="driver-identity">
                      <Avatar name={selectedDriver!.name} color="blue" size={60} />
                      <div>
                        <label htmlFor="demo-driver">TRY A DEMO DRIVER</label>
                        <select
                          id="demo-driver"
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                        >
                          {pool.drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} · {d.car}
                            </option>
                          ))}
                        </select>
                        <p>
                          {selectedDriver?.seats} passenger seats ·{' '}
                          {duration(selectedDriver?.etaSeconds ?? 0)} to first pickup
                        </p>
                      </div>
                      <span className="driver-status">
                        <i /> On route
                      </span>
                    </div>
                    <div className="driver-stat-grid">
                      <div>
                        <Icon name="people" size={20} />
                        <strong>{pool.quote.count} people</strong>
                        <span>One group request</span>
                      </div>
                      <div>
                        <Icon name="route" size={20} />
                        <strong>{money(pool.quote.driverPayout)} ETB</strong>
                        <span>Demo payout after 10% fee</span>
                      </div>
                    </div>
                    {pool.status === 'requested' ? (
                      <article className="group-call-card">
                        <div className="group-call-heading">
                          <span className="call-pulse" />
                          <strong>A group is going your way</strong>
                          <span>
                            {Math.max(0, Math.ceil(((pool.requestedUntil ?? 0) - now) / 1000))}s
                            left
                          </span>
                        </div>
                        <h3>
                          {pool.pickupName}
                          <Icon name="arrow" size={19} />
                          {destination?.name}
                        </h3>
                        <div className="group-call-people">
                          <Avatar name="You" size={38} />
                          {pool.riders
                            .filter((r) => r.selected)
                            .map((r) => (
                              <Avatar key={r.id} name={r.name} color={r.color} size={38} />
                            ))}
                          <span>{pool.quote.count} seats · forward pickups only</span>
                        </div>
                        <div className="call-pricing">
                          <span>
                            Group fare<strong>{pool.quote.total} ETB</strong>
                          </span>
                          <span>
                            Your demo payout<strong>{money(pool.quote.driverPayout)} ETB</strong>
                          </span>
                        </div>
                        {selectedDriver?.issue && (
                          <p className="driver-rejection">
                            <Icon name="clock" size={16} />
                            {selectedDriver.issue}
                          </p>
                        )}
                        <button
                          className="pool-primary"
                          disabled={
                            busy || !!selectedDriver?.issue || (pool.requestedUntil ?? 0) <= now
                          }
                          onClick={async () => {
                            if (await action('/accept', { groupId: pool.id, driverId }))
                              setView('discover');
                          }}
                        >
                          Accept group request
                          <Icon name="check" size={17} />
                        </button>
                        <p className="request-note">
                          Accepting locks this group and the agreed demo fare.
                        </p>
                      </article>
                    ) : (
                      <div className="pool-empty">
                        <Icon name="car" size={38} />
                        <h3>
                          {pool.status === 'accepted' || pool.status === 'in_progress'
                            ? 'Your group has a driver.'
                            : 'A good group is worth the wait.'}
                        </h3>
                        <p>
                          {pool.status === 'accepted' || pool.status === 'in_progress'
                            ? 'Return to your circle to start or complete the demo ride.'
                            : 'Build your circle and request a ride to try accepting it here.'}
                        </p>
                        <button className="pool-secondary" onClick={() => setView('discover')}>
                          Back to my circle
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    )}
                    <div className="driver-constraints">
                      <Icon name="shield" />
                      <div>
                        <strong>Every pickup must fit.</strong>
                        <p>
                          We check seats, direction, live readiness, and travel time to the final
                          pickup. A group is rejected if that exceeds 120 seconds.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
              <FarePanel
                pool={pool}
                busy={busy}
                now={now}
                action={action}
                driverView={() => setView('driver')}
                explain={() => setModal('fare')}
              />
            </div>
          )}
          <footer className="pool-footer">
            <span>
              Built for the way Addis moves.
              <Icon name="leaf" size={12} />
            </span>
            <div>
              <span>Demo people & travel times</span>
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
              {pool.quote.count} {pool.quote.count === 1 ? 'person' : 'people'} in your circle
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
        <Modal
          title={
            modal === 'fare'
              ? 'Small group. Smaller share.'
              : modal === 'location'
                ? 'Your location, your choice.'
                : 'A circle that goes your way.'
          }
          close={() => setModal(null)}
        >
          <div className="pool-modal-content">
            {modal === 'fare' ? (
              <>
                <p>
                  The demo uses a fixed fare for your route, divided equally between everyone in
                  your group. All amounts include the proposed 10% platform fee.
                </p>
                <div className="fare-example">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n}>
                      <span>
                        {n} {n === 1 ? 'rider' : 'riders'}
                      </span>
                      <strong>
                        {money((pool?.quote.total ?? 360) / n)}
                        <small> ETB each</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <p>
                  Shorter drop-offs use the same equal split in this demo. Your share is shown
                  before you request, and locked when you submit. We never add someone after the
                  group is requested.
                </p>
                <small>
                  Illustrative fares. No payments are collected. If a rider leaves before
                  acceptance, the request expires; you choose a new group and fare.
                </small>
              </>
            ) : modal === 'location' ? (
              <>
                <p>
                  Tap “Use my location” and allow your browser to access your position. We use that
                  one reading as your pickup location, anywhere. Or search for a place and select a
                  result, or confirm a pin on the map.
                </p>
                <p>
                  We don’t track you in the background. Precise coordinates stay within your own
                  session and its map and are not shown to other riders. Selecting a manual pickup
                  removes the device reading. Map tiles reveal the viewed area to OpenStreetMap;
                  place searches send your search text to Photon. We do not send GPS coordinates for
                  reverse geocoding.
                </p>
                <p>
                  A fresh device reading is needed within two minutes. If location is blocked or
                  inaccurate, search for your pickup or set a map pin instead. There is no fixed
                  pickup-area restriction.
                </p>
                <small>
                  GPS proximity does not prove a two-minute road journey. Travel times here are
                  fictional; a real routing provider must verify them before a live pilot.
                </small>
              </>
            ) : (
              <>
                <div className="how-step">
                  <b>01</b>
                  <div>
                    <h3>Start where you are.</h3>
                    <p>
                      Use your device location, search for any place, or set a map pin. Choose where
                      you’re going.
                    </p>
                  </div>
                </div>
                <div className="how-step">
                  <b>02</b>
                  <div>
                    <h3>Pick a fare tier, we match the riders.</h3>
                    <p>
                      Choose Solo, Pair, Trio, or Full car. We auto-fill eligible riders going your
                      way — no manual picking, no coordination headaches.
                    </p>
                  </div>
                </div>
                <div className="how-step">
                  <b>03</b>
                  <div>
                    <h3>Happy with the fare? Let’s go.</h3>
                    <p>
                      Request the group, then try Driver space to accept it. Start and complete a
                      demo journey.
                    </p>
                  </div>
                </div>
                <p className="two-minute-explanation">
                  The two-minute rule covers the whole pickup span. Driver acceptance also includes
                  travel to the first rider. Expired riders, wrong-way pickups, and insufficient
                  seats are rejected.
                </p>
                <small>
                  All profiles, rider consent, road times, and driver responses are simulated. This
                  is a private demo, not a live dispatch.
                </small>
              </>
            )}
            <button className="pool-primary" onClick={() => setModal(null)}>
              Got it
              <Icon name="check" size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
