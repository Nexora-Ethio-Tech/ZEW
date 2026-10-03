'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon, type IconName } from '@/components/icon';
import { RouteMap } from '@/components/route-map';
import { Modal } from '@/components/modal';
import {
  api,
  day,
  time,
  localDeparture,
  type Booking,
  type Commute,
  type Dashboard,
  type Journey,
  type Matches,
  type Trip,
} from '@/lib/api';

type View = 'find' | 'rides' | 'saved' | 'driver' | 'earnings';
type Dialog = 'waitlist' | 'help' | 'save' | 'offer' | 'booking' | 'board' | 'account' | null;
const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'find', label: 'Plan ahead', icon: 'route' },
  { id: 'rides', label: 'My rides', icon: 'rides' },
  { id: 'saved', label: 'Saved commutes', icon: 'bookmark' },
  { id: 'driver', label: 'Driver space', icon: 'car' },
  { id: 'earnings', label: 'Earnings', icon: 'wallet' },
];
const statusLabel = {
  confirmed: 'Seat confirmed',
  in_progress: 'On the way',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function Workspace() {
  const [data, setData] = useState<Dashboard>();
  const [view, setView] = useState<View>('find');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [journey, setJourney] = useState<Journey>({
    corridorId: 'bole-centre',
    origin: 'bole',
    destination: 'meskel',
    departure: '',
    seats: 1,
  });
  const [results, setResults] = useState<Matches>();
  const [selected, setSelected] = useState<Trip>();
  const [boarding, setBoarding] = useState<Booking>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const refresh = useCallback(async () => {
    const next = await api<Dashboard>('/dashboard');
    setData(next);
    return next;
  }, []);
  const initialize = useCallback(async () => {
    setError('');
    try {
      const next = await refresh();
      setJourney((j) => ({
        ...j,
        departure: j.departure || next.trips.find((t) => t.source === 'sample')!.departure,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Zew');
    }
  }, [refresh]);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const stopName = (id: string) =>
    data?.corridors.flatMap((c) => c.stops).find((s) => s.id === id)?.name ?? id;
  const corridor = data?.corridors.find((c) => c.id === journey.corridorId);
  const completed = data?.bookings.filter((b) => b.status === 'completed') ?? [];
  const active =
    data?.bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress') ?? [];
  const updateJourney = (changes: Partial<Journey>) => {
    setJourney((j) => ({ ...j, ...changes }));
    setResults(undefined);
    setError('');
  };
  const open = (next: Dialog) => {
    setError('');
    setDialog(next);
  };
  const navigate = (next: View) => {
    setView(next);
    setError('');
  };
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function search(e?: FormEvent) {
    e?.preventDefault();
    await run(async () => {
      setResults(await api<Matches>('/matches', 'POST', journey));
    });
  }
  function useCommute(commute: Commute) {
    const departure =
      Date.parse(commute.departure) > Date.now()
        ? commute.departure
        : `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T${time(commute.departure)}:00+03:00`;
    updateJourney({
      corridorId: commute.corridorId,
      origin: commute.origin,
      destination: commute.destination,
      departure,
      seats: commute.seats,
    });
    navigate('find');
  }
  function StopField({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (stopId: string) => void;
  }) {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);

    const allStops = Array.from(
      new Map((data?.corridors || []).flatMap((c) => c.stops).map((s) => [s.id, s])).values()
    );

    const selectedStop = allStops.find((s) => s.id === value);
    const displayValue = focused ? query : selectedStop?.name || '';

    const matches = query
      ? allStops.filter(
          (s) =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.area?.toLowerCase().includes(query.toLowerCase())
        )
      : allStops;

    return (
      <div className="location-field" style={{ position: 'relative' }}>
        <span className={`location-marker ${label.toLowerCase()}`} />
        <span style={{ width: '100%' }}>
          <small>{label.toUpperCase()}</small>
          <input
            type="text"
            placeholder="Search places..."
            value={displayValue}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!focused) setFocused(true);
            }}
            onFocus={() => {
              setQuery('');
              setFocused(true);
            }}
            onBlur={() => {
              setTimeout(() => setFocused(false), 200);
            }}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 16 }}
          />
        </span>
        {focused && (
          <div className="place-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                className="place-result"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #eee' }}
                onClick={() => {
                  onChange(s.id);
                  setQuery('');
                  setFocused(false);
                }}
              >
                <strong>{s.name}</strong>
                <br />
                <small style={{ color: '#666' }}>{s.area}</small>
              </button>
            ))}
            {!matches.length && (
              <div style={{ padding: '8px 12px', color: '#666' }}>No places found.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  function routeFields() {
    return (
      <>
        <div className="route-inputs">
          <StopField
            label="Pickup"
            value={journey.origin}
            onChange={(origin) => {
              const c = data!.corridors.find((c) => c.stops.some((s) => s.id === origin))!;
              updateJourney({ origin, corridorId: c.id });
            }}
          />
          <button
            type="button"
            className="swap-button"
            aria-label="Swap pickup and destination"
            onClick={() =>
              updateJourney({ origin: journey.destination, destination: journey.origin })
            }
          >
            <Icon name="swap" size={16} />
          </button>
          <StopField
            label="Drop-off"
            value={journey.destination}
            onChange={(destination) => {
              const c = data!.corridors.find((c) => c.stops.some((s) => s.id === destination))!;
              updateJourney({ destination, corridorId: c.id });
            }}
          />
        </div>
        <div className="form-row" style={{ marginTop: 16 }}>
          <label className="field" style={{ width: '100%' }}>
            Departure · Addis time
            <input
              aria-label="Departure time"
              required
              type="datetime-local"
              value={journey.departure ? localDeparture(journey.departure) : ''}
              onChange={(e) => {
                if (e.target.value) updateJourney({ departure: `${e.target.value}:00+03:00` });
              }}
            />
          </label>
        </div>
        <div className="fare-tier-grid" style={{ gridColumn: '1 / -1', marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { seats: 1, label: 'Solo', sublabel: 'Just you', icon: '👤' },
            { seats: 2, label: 'Pair', sublabel: 'You + 1', icon: '👥' },
            { seats: 3, label: 'Trio', sublabel: 'You + 2', icon: '🧑‍🤝‍🧑' },
            { seats: 4, label: 'Full car', sublabel: 'You + 3', icon: '🚗' },
          ].map(({ seats, label, sublabel, icon }) => {
            const previewFare = 360 / seats; 
            const active = journey.seats === seats;
            return (
              <button
                key={seats}
                type="button"
                className={`fare-tier-card ${active ? 'is-active' : ''}`}
                onClick={() => updateJourney({ seats })}
                style={{ border: active ? '2px solid #285943' : '1px solid #ccc', borderRadius: 8, padding: 8, background: active ? '#eaffef' : '#fff', cursor: 'pointer', textAlign: 'center' }}
              >
                <span style={{ fontSize: 24, display: 'block' }}>{icon}</span>
                <strong style={{ display: 'block', margin: '4px 0' }}>{label}</strong>
                <span style={{ fontSize: 12, color: '#666', display: 'block' }}>{previewFare} ETB</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Zew home">
          zew<span className="brand-dot">.</span>
          <span className="brand-lines">
            <i />
            <i />
            <i />
          </span>
        </a>
        <div className="city-label">
          <span className="live-dot" /> ADDIS ABABA
        </div>
        <p className="nav-heading">{role === 'passenger' ? 'YOUR EVERYDAY JOURNEY' : 'YOUR DRIVER SPACE'}</p>
        <nav aria-label="Main navigation">
          {navigation.filter(item => role === 'passenger' ? (item.id !== 'driver' && item.id !== 'earnings') : (item.id === 'driver' || item.id === 'earnings')).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'selected' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'rides' && active.length > 0 && (
                <span className="count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-card">
            <span className="small-icon">
              <Icon name="leaf" />
            </span>
            <h3>
              A little less traffic.
              <br />A lot more possibility.
            </h3>
            <p>Help shape a better commute for Addis.</p>
            <button onClick={() => open('waitlist')}>
              {data?.waitlistJoined ? 'Registration saved' : 'Join the pilot'}
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <button className="nav-item help-button" onClick={() => open('help')}>
            <Icon name="help" />
            How Zew works
          </button>
        </div>
      </aside>
      <div className="page-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Your commute <span>/</span>{' '}
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </span>
          <div className="topbar-right">
            <span className="demo-pill">INTERACTIVE DEMO</span>
            <span className="timezone">
              <Icon name="sun" size={16} /> Addis Ababa · UTC+3
            </span>
            <button
              className="topbar-avatar"
              onClick={() => open('account')}
              aria-label="Account details"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: '#285943',
                color: '#fff',
                fontSize: 14,
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 16,
              }}
            >
              Y
            </button>
          </div>
        </header>
        <main id="main">
          {notice && (
            <div role="status" className="toast">
              <Icon name="check" />
              {notice}
              <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {error && !dialog && (
            <div role="alert" className="error-banner">
              {error}
              {!data && <button onClick={() => void initialize()}>Retry connection</button>}
            </div>
          )}
          {!data ? (
            <div className="loading-state">
              <span className="loading-dot" />
              <h1>Welcome to Zew.</h1>
              <p>
                {error
                  ? 'Start the backend and retry to explore your commute.'
                  : 'Getting your workspace ready…'}
              </p>
            </div>
          ) : (
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> SAME DIRECTION. SHARED RIDE.
                  </p>
                  <h1>
                    {view === 'find' ? (
                      <>
                        Wherever you’re going,
                        <br />
                        <em>go together.</em>
                      </>
                    ) : view === 'rides' ? (
                      <>
                        Every journey,
                        <br />
                        <em>in one place.</em>
                      </>
                    ) : view === 'saved' ? (
                      <>
                        Your usual routes.
                        <br />
                        <em>Ready when you are.</em>
                      </>
                    ) : (
                      <>
                        Going that way?
                        <br />
                        <em>Share the journey.</em>
                      </>
                    )}
                  </h1>
                  <p className="heading-description">
                    {view === 'find'
                      ? 'Find a seat with someone already heading your way.'
                      : view === 'rides'
                        ? 'Your upcoming rides, boarding details, and trip history.'
                        : view === 'saved'
                          ? 'Keep your favourite commutes close. Find your next ride faster.'
                          : 'Offer the seats you have. Make your everyday drive go further.'}
                  </p>
                </div>
                <div className="heading-note">
                  <Icon name={view === 'driver' ? 'car' : 'leaf'} size={29} />
                  <span>
                    A shared ride.
                    <br />A lighter city.
                  </span>
                </div>
              </section>
              {view === 'find' && (
                <>
                  <section className="journey-grid">
                    <form className="search-card card" onSubmit={search}>
                      <div className="section-title">
                        <h2>Where are you heading?</h2>
                        <Icon name="route" />
                      </div>
                      {routeFields()}
                      <button className="primary full" disabled={busy} type="submit">
                        {busy ? 'Finding your route…' : 'Find my ride'}
                        <Icon name="arrow" size={18} />
                      </button>
                      <button type="button" className="save-link" onClick={() => open('save')}>
                        <Icon name="bookmark" size={15} /> Save this commute
                      </button>
                    </form>
                    <RouteMap
                      corridor={corridor}
                      originId={journey.origin}
                      destinationId={journey.destination}
                    />
                  </section>
                  {results && (
                    <section className="results-section" aria-live="polite">
                      <div className="section-title">
                        <h2>
                          {results.matches.length
                            ? `${results.matches.length} rides going your way`
                            : 'No rides for this route yet'}
                        </h2>
                        <span className="muted">Within 30 minutes of your departure</span>
                      </div>
                      {results.matches.length ? (
                        <div className="match-list">
                          {results.matches.map((trip, index) => (
                            <article className="match-card card" key={trip.id}>
                              <span className={`avatar driver-avatar tone-${index}`}>
                                {trip.driver[0]}
                              </span>
                              <div className="driver-details">
                                <strong>
                                  {trip.driver} <span className="sample-label">Sample driver</span>
                                </strong>
                                <span>{trip.vehicle}</span>
                                <small>
                                  <Icon name="route" size={13} /> Same direction ·{' '}
                                  {trip.availableSeats} seats left
                                </small>
                              </div>
                              <div className="match-time">
                                <strong>{time(trip.departure)}</strong>
                                <span>{day(trip.departure)}</span>
                              </div>
                              <div className="match-price">
                                <strong>
                                  {trip.fare}
                                  <small> ETB</small>
                                </strong>
                                <span>per seat · demo fare</span>
                              </div>
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() => {
                                  setSelected(trip);
                                  open('booking');
                                }}
                              >
                                Choose ride
                                <Icon name="arrow" size={16} />
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-inline">
                          <Icon name="route" size={30} />
                          <p>
                            Try a different time, fewer seats, or another corridor. Sample trips
                            depart tomorrow around 08:00 when your session is created.
                          </p>
                        </div>
                      )}
                      {results.rejected.length > 0 && (
                        <details className="match-reasons">
                          <summary>Why some trips didn’t match</summary>
                          <ul>
                            {results.rejected.map((r) => (
                              <li key={r.tripId}>
                                {data.trips.find((t) => t.id === r.tripId)?.driver}: {r.reason}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </section>
                  )}

                </>
              )}
              {view === 'rides' && (
                <>
                  <div className="content-toolbar">
                    <div className="tabs">
                      <button
                        className={filter === 'upcoming' ? 'active' : ''}
                        onClick={() => setFilter('upcoming')}
                      >
                        Upcoming <span>{active.length}</span>
                      </button>
                      <button
                        className={filter === 'past' ? 'active' : ''}
                        onClick={() => setFilter('past')}
                      >
                        Past rides
                      </button>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await refresh();
                          setNotice('Your rides are up to date.');
                        })
                      }
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="booking-list">
                    {data.bookings
                      .filter((b) =>
                        filter === 'upcoming'
                          ? ['confirmed', 'in_progress'].includes(b.status)
                          : ['completed', 'cancelled'].includes(b.status),
                      )
                      .map((b) => (
                        <article key={b.id} className="card booking-card">
                          <div className="section-title">
                            <span className={`status-pill ${b.status}`}>
                              {statusLabel[b.status]}
                            </span>
                            <span className="muted">
                              {day(b.departure)} · {time(b.departure)} EAT
                            </span>
                          </div>
                          <h2>
                            {stopName(b.origin)} <span className="route-arrow">→</span>{' '}
                            {stopName(b.destination)}
                          </h2>
                          <p>
                            {b.driver} · {b.vehicle} · {b.seats} {b.seats === 1 ? 'seat' : 'seats'}
                          </p>
                          <div className="booking-bottom">
                            {b.status === 'confirmed' ? (
                              <div className="boarding-code">
                                <small>YOUR BOARDING CODE</small>
                                <strong>{b.code}</strong>
                                <span>Use this in Driver space to simulate boarding.</span>
                              </div>
                            ) : (
                              <p>
                                {b.status === 'completed'
                                  ? 'Demo payment recorded. No money was charged.'
                                  : b.status === 'in_progress'
                                    ? 'Your demo journey is in progress.'
                                    : 'Your reservation was cancelled. No charge.'}
                              </p>
                            )}
                            <div className="booking-fare">
                              <strong>{b.fare} ETB</strong>
                              <small>Total demo fare</small>
                            </div>
                          </div>
                          {b.status === 'confirmed' && (
                            <button
                              className="danger-link"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await api(`/bookings/${b.id}/action`, 'POST', {
                                    action: 'cancel',
                                  });
                                  await refresh();
                                  setNotice('Ride cancelled. Your seats have been released.');
                                })
                              }
                            >
                              Cancel reservation
                            </button>
                          )}
                        </article>
                      ))}
                  </div>
                  {!(filter === 'upcoming'
                    ? active.length
                    : data.bookings.length - active.length) && (
                    <Empty
                      icon="rides"
                      title={
                        filter === 'upcoming' ? 'Your next journey starts here.' : 'A fresh start.'
                      }
                      text={
                        filter === 'upcoming'
                          ? 'Find a ride that fits your route. Your booking and boarding code will appear here.'
                          : 'Completed and cancelled rides will appear here.'
                      }
                      action="Find a ride"
                      onClick={() => navigate('find')}
                    />
                  )}
                </>
              )}
              {view === 'saved' && (
                <>
                  <div className="content-toolbar">
                    <p className="muted">{data.commutes.length} of 10 commutes saved</p>
                    <button className="secondary" onClick={() => navigate('find')}>
                      <Icon name="plus" size={17} /> Add a commute
                    </button>
                  </div>
                  <div className="saved-grid">
                    {data.commutes.map((c) => (
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
                          <button className="primary" onClick={() => useCommute(c)}>
                            Use this route
                            <Icon name="arrow" size={16} />
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(`/commutes/${c.id}`, 'DELETE');
                                await refresh();
                                setNotice('Commute removed.');
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!data.commutes.length && (
                    <Empty
                      icon="bookmark"
                      title="Make your everyday a little easier."
                      text="Choose your pickup, drop-off, and preferred time in Find a ride, then save your commute."
                      action="Save my first route"
                      onClick={() => navigate('find')}
                    />
                  )}
                </>
              )}
              {view === 'driver' && (
                <>
                  <div className="driver-stats">
                    <Stat
                      label="Your offered trips"
                      value={String(
                        data.trips.filter((t) => t.source === 'yours' && t.status === 'open')
                          .length,
                      )}
                      icon="car"
                    />
                    <Stat
                      label="Completed demo rides"
                      value={String(completed.length)}
                      icon="check"
                    />
                    <Stat
                      label="Simulated driver payout"
                      value={`${completed.reduce((n, b) => n + b.fare * 0.9, 0).toFixed(0)} ETB`}
                      icon="people"
                    />
                  </div>
                  <div className="driver-note">
                    <Icon name="help" size={18} />
                    <p>
                      This is your private driver sandbox. You can offer trips and simulate boarding
                      for your sample ride bookings. Trips aren’t published to other people.
                    </p>
                  </div>
                  <div className="section-title">
                    <h2>Your offered trips</h2>
                    <button className="primary" onClick={() => open('offer')}>
                      <Icon name="plus" size={17} /> Offer a ride
                    </button>
                  </div>
                  <div className="offered-list">
                    {data.trips
                      .filter((t) => t.source === 'yours')
                      .map((t) => (
                        <article className="card offered-card" key={t.id}>
                          <span className="small-icon">
                            <Icon name="car" />
                          </span>
                          <div>
                            <strong>
                              {stopName(t.origin)} → {stopName(t.destination)}
                            </strong>
                            <p>
                              {day(t.departure)} · {time(t.departure)} EAT · {t.seats} seats ·{' '}
                              {t.vehicle}
                            </p>
                          </div>
                          {t.status === 'open' ? (
                            <button
                              className="danger-link"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await api(`/trips/${t.id}/cancel`, 'POST');
                                  await refresh();
                                  setNotice('Your trip has been cancelled.');
                                })
                              }
                            >
                              Cancel offer
                            </button>
                          ) : (
                            <span className="status-pill cancelled">Cancelled</span>
                          )}
                        </article>
                      ))}
                  </div>
                  {!data.trips.some((t) => t.source === 'yours') && (
                    <div className="empty-inline">
                      <Icon name="car" size={28} />
                      <p>Heading across town? Offer a seat on your planned route.</p>
                    </div>
                  )}
                  <div className="section-title boarding-title">
                    <h2>Boarding simulator</h2>
                    <span className="muted">For bookings in My rides</span>
                  </div>
                  {active.map((b) => (
                    <article key={b.id} className="card offered-card">
                      <span className="avatar">Y</span>
                      <div>
                        <strong>
                          {stopName(b.origin)} → {stopName(b.destination)}
                        </strong>
                        <p>
                          {statusLabel[b.status]} · {b.seats} seats · {b.fare} ETB demo fare
                        </p>
                      </div>
                      {b.status === 'confirmed' ? (
                        <button
                          className="secondary"
                          onClick={() => {
                            setBoarding(b);
                            open('board');
                          }}
                        >
                          Enter boarding code
                        </button>
                      ) : (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(`/bookings/${b.id}/action`, 'POST', { action: 'complete' });
                              await refresh();
                              setNotice(
                                'Demo trip completed. Simulated receipt added to Past rides.',
                              );
                            })
                          }
                        >
                          Complete demo trip
                          <Icon name="check" size={17} />
                        </button>
                      )}
                    </article>
                  ))}
                  {!active.length && (
                    <div className="empty-inline">
                      <Icon name="people" size={28} />
                      <p>Book a sample ride first to try the boarding and completion flow.</p>
                    </div>
                  )}
                  {data.events.length > 0 && (
                    <details className="activity-log">
                      <summary>Workspace activity</summary>
                      {data.events.slice(0, 8).map((e, i) => (
                        <p key={`${e.entityId}-${i}`}>
                          <span>{e.kind.replaceAll('.', ' ')}</span>
                          <small>
                            {day(e.createdAt)} · {time(e.createdAt)}
                          </small>
                        </p>
                      ))}
                    </details>
                  )}
                </>
              )}
              {view === 'earnings' && (
                <div className="earnings-view">
                  <div className="section-title" style={{ marginBottom: 24 }}>
                    <h2>Your Earnings</h2>
                    <p style={{ color: '#69735f', margin: 0, fontSize: 14 }}>Track your simulated payouts and performance.</p>
                  </div>
                  <div className="driver-stats" style={{ marginBottom: 32 }}>
                    <Stat
                      label="Today"
                      value="0 ETB"
                      icon="wallet"
                    />
                    <Stat
                      label="This week"
                      value={`${completed.reduce((n, b) => n + b.fare * 0.9, 0).toFixed(0)} ETB`}
                      icon="bookmark"
                    />
                    <Stat
                      label="This month"
                      value={`${completed.reduce((n, b) => n + b.fare * 0.9, 0).toFixed(0)} ETB`}
                      icon="check"
                    />
                  </div>
                  <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Payout History</h3>
                    {completed.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {completed.map((b) => (
                          <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #e1e3de' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: 16 }}>Trip payout</strong>
                              <small style={{ color: '#69735f' }}>{day(b.departure)}</small>
                            </div>
                            <strong style={{ fontSize: 16, color: '#285943' }}>+{(b.fare * 0.9).toFixed(0)} ETB</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#69735f', margin: 0 }}>No completed rides yet. Your simulated payouts will appear here.</p>
                    )}
                  </div>
                </div>
              )}
              <footer>
                <span className="footer-brand">zew.</span>
                <span>A better everyday, together.</span>
                <button className="text-button" onClick={() => open('help')}>
                  How it works
                </button>
                <button className="text-button" onClick={() => open('waitlist')}>
                  {data.waitlistJoined ? 'Registration saved' : 'Join the pilot'}
                </button>
                <span className="footer-disclaimer">
                  Demo workspace · Sample routes & fares · No real rides or charges
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {dialog && (
        <Modal
          title={
            {
              waitlist: 'Be part of the first chapter.',
              help: 'Same direction. Shared ride.',
              save: 'Save your everyday route',
              offer: 'Offer a seat on your route',
              booking: 'Your ride, at a glance',
              board: 'Ready to board?',
              account: 'Account',
            }[dialog]!
          }
          close={() => {
            if (!busy) setDialog(null);
          }}
        >
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          {dialog === 'help' && (
            <div className="help-content">
              <p>
                Zew connects commuters with drivers already travelling their way. Start with a
                corridor, choose your stops, and find a compatible seat.
              </p>
              {[
                [
                  '01',
                  'Choose your journey',
                  'Pick your departure time and how many seats you need.',
                ],
                [
                  '02',
                  'Find your forward match',
                  'The demo checks stop order, departure time, and available seats.',
                ],
                [
                  '03',
                  'Try the complete journey',
                  'Reserve a ride, find your code in My rides, then use Driver space to board and complete it.',
                ],
              ].map(([n, title, description]) => (
                <div className="help-step" key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
              <p className="fine-print">
                This local demo has sample drivers and illustrative routes. Road access, safe pickup
                points, driver verification, and real payments are not connected. Your session is
                saved on this browser for up to 30 days.
              </p>
              <button
                className="primary full"
                onClick={() => {
                  setDialog(null);
                  navigate('find');
                }}
              >
                Let’s find a ride
                <Icon name="arrow" size={17} />
              </button>
            </div>
          )}
          {dialog === 'save' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                void run(async () => {
                  await api('/commutes', 'POST', { ...journey, name: values.get('name') });
                  await refresh();
                  setDialog(null);
                  setNotice('Your commute is saved. Find it in Saved commutes.');
                });
              }}
            >
              <p className="modal-description">
                {stopName(journey.origin)} → {stopName(journey.destination)}
                <br />
                {journey.departure && time(journey.departure)} EAT · {journey.seats} seats
              </p>
              <label className="field">
                Give it a name
                <input
                  name="name"
                  required
                  maxLength={40}
                  placeholder="e.g. My morning commute"
                  autoFocus
                />
              </label>
              <button className="primary full" disabled={busy}>
                Save commute
                <Icon name="bookmark" size={17} />
              </button>
            </form>
          )}
          {dialog === 'booking' && selected && (
            <div>
              <p className="modal-description">
                {stopName(journey.origin)} → {stopName(journey.destination)}
              </p>
              <div className="booking-summary">
                <p>
                  <span>Sample driver</span>
                  <strong>{selected.driver}</strong>
                </p>
                <p>
                  <span>Departure</span>
                  <strong>
                    {day(selected.departure)} · {time(selected.departure)} EAT
                  </strong>
                </p>
                <p>
                  <span>Vehicle</span>
                  <strong>{selected.vehicle}</strong>
                </p>
                <p>
                  <span>Seats</span>
                  <strong>{journey.seats}</strong>
                </p>
                <p className="total">
                  <span>Total demo fare</span>
                  <strong>{selected.fare * journey.seats} ETB</strong>
                </p>
              </div>
              <p className="fine-print">
                This reserves a seat in your private demo. No driver is contacted and no money is
                charged.
              </p>
              <button
                className="primary full"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api('/bookings', 'POST', { ...journey, tripId: selected.id });
                    await refresh();
                    setResults(undefined);
                    setDialog(null);
                    setView('rides');
                    setFilter('upcoming');
                    setNotice('Your demo seat is confirmed. Your boarding code is below.');
                  })
                }
              >
                {busy ? 'Reserving…' : 'Confirm demo reservation'}
                <Icon name="check" size={17} />
              </button>
            </div>
          )}
          {dialog === 'offer' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                void run(async () => {
                  await api('/trips', 'POST', {
                    ...journey,
                    driver: values.get('driver'),
                    vehicle: values.get('vehicle'),
                  });
                  await refresh();
                  setDialog(null);
                  setNotice('Your trip offer is saved in your driver sandbox.');
                });
              }}
            >
              <p className="modal-description">
                Share a planned journey. Demo fare is set at 100 ETB per seat, with a simulated 10%
                platform fee.
              </p>
              <div className="form-row">
                <label className="field">
                  Driver name
                  <input
                    name="driver"
                    required
                    minLength={2}
                    maxLength={40}
                    placeholder="Your display name"
                  />
                </label>
                <label className="field">
                  Vehicle
                  <input
                    name="vehicle"
                    required
                    minLength={2}
                    maxLength={60}
                    placeholder="e.g. Toyota Vitz"
                  />
                </label>
              </div>
              {routeFields()}
              <button className="primary full" disabled={busy}>
                Save demo offer
                <Icon name="arrow" size={17} />
              </button>
            </form>
          )}
          {dialog === 'board' && boarding && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                void run(async () => {
                  await api(`/bookings/${boarding.id}/action`, 'POST', {
                    action: 'board',
                    code: values.get('code'),
                  });
                  await refresh();
                  setDialog(null);
                  setNotice('Code confirmed. Your demo journey is underway.');
                });
              }}
            >
              <p className="modal-description">
                Enter the four-digit boarding code from My rides to start this demo journey.
              </p>
              <label className="field">
                Boarding code
                <input
                  className="code-input"
                  name="code"
                  required
                  pattern="[0-9]{4}"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  placeholder="0000"
                />
              </label>
              <button className="primary full" disabled={busy}>
                Confirm boarding
                <Icon name="check" size={17} />
              </button>
            </form>
          )}
          {dialog === 'waitlist' &&
            (data?.waitlistJoined ? (
              <div className="registration-success">
                <span className="small-icon">
                  <Icon name="check" size={28} />
                </span>
                <h3>Your interest is saved.</h3>
                <p>
                  This registration is stored in your local demo database. It does not subscribe you
                  to a live mailing list or send an email.
                </p>
                <button className="primary full" onClick={() => setDialog(null)}>
                  Back to my commute
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = new FormData(e.currentTarget);
                  void run(async () => {
                    await api('/waitlist', 'POST', {
                      name: values.get('name'),
                      email: values.get('email'),
                      role: values.get('role'),
                      consent: values.get('consent') === 'on',
                    });
                    await refresh();
                  });
                }}
              >
                <p className="modal-description">
                  Help shape a shared commute for Addis. Try the registration flow with a test
                  email.
                </p>
                <label className="field">
                  Name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Your name"
                  />
                </label>
                <label className="field">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={120}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="field">
                  I’m interested in
                  <select name="role">
                    <option value="rider">Finding a ride</option>
                    <option value="driver">Sharing my drive</option>
                  </select>
                </label>
                <label className="consent">
                  <input name="consent" type="checkbox" required />
                  <span>
                    I agree to save these details in this local demo. No email will be sent.
                  </span>
                </label>
                <button className="primary full" disabled={busy}>
                  Save my interest
                  <Icon name="arrow" size={17} />
                </button>
              </form>
            ))}
          {dialog === 'account' && (
            <div className="account-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <span className="avatar" style={{ width: 56, height: 56, background: '#285943', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>Y</span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>Your workspace</h3>
                  <p style={{ margin: 0, color: '#69735f', fontSize: 14 }}>Personal demo session</p>
                </div>
              </div>
              <div className="role-toggle" style={{ marginBottom: 24, background: '#f8f8ee', borderRadius: 12, padding: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Active Mode</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className={`secondary ${role === 'passenger' ? 'active' : ''}`}
                    style={{ flex: 1, border: role === 'passenger' ? '2px solid #285943' : undefined }}
                    onClick={() => { setRole('passenger'); setView('find'); setDialog(null); }}
                  >
                    Passenger
                  </button>
                  <button 
                    className={`secondary ${role === 'driver' ? 'active' : ''}`}
                    style={{ flex: 1, border: role === 'driver' ? '2px solid #285943' : undefined }}
                    onClick={() => { setRole('driver'); setView('driver'); setDialog(null); }}
                  >
                    Driver
                  </button>
                </div>
              </div>
              <button className="secondary full" onClick={() => setDialog(null)}>
                Close
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: IconName;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state card">
      <span className="empty-icon">
        <Icon name={icon} size={32} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={onClick}>
        {action}
        <Icon name="arrow" size={17} />
      </button>
    </div>
  );
}
function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="card stat">
      <span className="small-icon">
        <Icon name={icon} />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
