'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon, type IconName } from '@/components/icon';
import { RouteMap } from '@/components/route-map';
import { Modal } from '@/components/modal';
import { signOut } from '@/lib/auth';
import { AuthModal } from '../auth/auth-modal';
import { usePassengerAccount } from '../auth/passenger-access';
import { JourneyFields } from './journey-fields';
import { BookingConfirmation, DriverProfile } from './booking-details';
import './planned.css';
import { WorkspaceHeader } from './workspace-header';
import { RideResults } from './ride-results';
import { RideRecords, SavedCommutes } from './ride-records';
import {
  api,
  time,
  type Commute,
  type Dashboard,
  type Journey,
  type Matches,
  type Trip,
} from '@/lib/api';
import { getTranslation, type Language, type Theme } from '@/lib/i18n';
import { applyTheme, getStoredTheme } from '@/lib/theme';

type View = 'find' | 'rides' | 'saved';
type Dialog = 'help' | 'save' | 'booking' | 'account' | 'auth' | 'driver-profile' | null;

const passengerNavigation: {
  id: View;
  labelKey: string;
  label: string;
  icon: IconName;
}[] = [
  { id: 'find', labelKey: 'planAhead', label: 'Plan ahead', icon: 'route' },
  { id: 'rides', labelKey: 'myRides', label: 'My rides', icon: 'rides' },
  { id: 'saved', labelKey: 'savedCommutes', label: 'Saved commutes', icon: 'bookmark' },
];

export function PlannedWorkspace() {
  const user = usePassengerAccount();
  const [data, setData] = useState<Dashboard>();
  const [view, setView] = useState<View>('find');

  const [dialog, setDialog] = useState<Dialog>(null);
  const [journey, setJourney] = useState<Journey>({
    corridorId: '',
    origin: '',
    destination: '',
    departure: '',
    seats: 1,
  });
  const [results, setResults] = useState<Matches>();
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [selected, setSelected] = useState<Trip>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const active = getStoredTheme();
    setTheme(active);
    applyTheme(active);
  }, []);
  useEffect(() => {
    if (journey.corridorId || !data?.corridors.length) return;
    const corridor = data.corridors[0];
    setJourney((current) => ({
      ...current,
      corridorId: corridor.id,
      origin: corridor.stops[0].id,
      destination: corridor.stops[Math.min(3, corridor.stops.length - 1)].id,
    }));
  }, [data?.corridors, journey.corridorId]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const t = (key: string) => getTranslation(lang, key);

  const authUser = user;

  const readSequence = useRef(0);
  const searchSequence = useRef(0);
  const readsPending = useRef(0);
  const mutationPending = useRef(false);
  const [syncError, setSyncError] = useState('');
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    readsPending.current++;
    try {
      const next = await api<Dashboard>('/dashboard');
      if (sequence === readSequence.current) {
        setData(next);
        setSyncError('');
      }
      return next;
    } finally {
      readsPending.current--;
    }
  }, []);

  const initialize = useCallback(async () => {
    setError('');
    try {
      await refresh();
      setJourney((j) => ({
        ...j,
        departure: j.departure || new Date().toISOString(),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Zew');
    }
  }, [refresh]);

  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const poll = setInterval(() => {
      if (!document.hidden && navigator.onLine && !readsPending.current && !mutationPending.current)
        void refresh().catch(() =>
          setSyncError('Updates paused. Check your connection and refresh.'),
        );
    }, 5000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const stopName = (id: string) =>
    data?.corridors.flatMap((c) => c.stops).find((s) => s.id === id)?.name ?? id;
  const corridor = data?.corridors.find((c) => c.id === journey.corridorId);
  const active =
    data?.bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress') ?? [];

  const updateJourney = (changes: Partial<Journey>) => {
    searchSequence.current++;
    setJourney((j) => ({ ...j, ...changes }));
    setResults(undefined);
    setError('');
  };

  const open = (next: Dialog) => {
    setError('');
    setDialog(next);
  };

  const navigate = (next: View) => {
    if (next !== 'find' && next !== 'rides' && next !== 'saved') return;
    setView(next);
    setError('');
  };

  async function run(task: () => Promise<void>) {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await run(async () => {
      await signOut();
      window.location.href = '/';
    });
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    await run(async () => {
      const activeDeparture =
        !journey.departure || Date.parse(journey.departure) <= Date.now()
          ? new Date().toISOString()
          : journey.departure;
      const activeJourney = { ...journey, departure: activeDeparture };
      if (activeDeparture !== journey.departure) {
        setJourney(activeJourney);
      }
      const sequence = ++searchSequence.current;
      const matches = await api<Matches>('/matches', 'POST', activeJourney);
      if (sequence === searchSequence.current) {
        setResults(matches);
        setMapCollapsed(true);
      }
    });
  }

  function useCommute(commute: Commute) {
    const departure =
      Date.parse(commute.departure) > Date.now()
        ? commute.departure
        : `${new Date(Date.now() + 86400000 + 3 * 3600000).toISOString().slice(0, 10)}T${time(commute.departure)}:00+03:00`;
    updateJourney({
      corridorId: commute.corridorId,
      origin: commute.origin,
      destination: commute.destination,
      departure,
      seats: commute.seats,
    });
    navigate('find');
  }

  return (
    <div className={`app-shell ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Zew home">
          zew<span className="brand-dot">.</span>
          <span className="brand-lines">
            <i />
            <i />
            <i />
          </span>
        </a>
        <p className="sidebar-demo-label">PREVIEW ENVIRONMENT · NO LIVE BOOKINGS</p>
        <div className="city-label">
          <span className="live-dot" /> ADDIS ABABA
        </div>
        <p className="nav-heading">YOUR EVERYDAY JOURNEY</p>
        <nav aria-label="Main navigation">
          {passengerNavigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'selected' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
              {item.id === 'rides' && active.length > 0 && (
                <span className="count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => open('account')}
            aria-label="Workspace controls"
          >
            <Icon name="people" /> Workspace controls
          </button>
          <button className="nav-item help-button" onClick={() => open('help')}>
            <Icon name="help" />
            How Zew works
          </button>
        </div>
      </aside>

      <div className="page-shell">
        <WorkspaceHeader
          account={user}
          language={lang}
          theme={theme}
          setLanguage={setLang}
          toggleTheme={handleToggleTheme}
          openAccount={() => open('account')}
          signIn={() => open('auth')}
        />

        <main id="main">
          {syncError && (
            <div className="error-banner" role="status">
              {syncError}
              <button
                onClick={() =>
                  void run(async () => {
                    await refresh();
                  })
                }
              >
                Refresh
              </button>
            </div>
          )}
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
                {error ? 'Check your connection and try again.' : 'Getting your workspace ready…'}
              </p>
            </div>
          ) : (
            <>
              {view !== 'find' && (
                <section className="page-heading">
                  <div>
                    <h1>
                      {view === 'rides' ? (
                        <>
                          Every journey,
                          <br />
                          <em>in one place.</em>
                        </>
                      ) : (
                        <>
                          Your usual routes.
                          <br />
                          <em>Ready when you are.</em>
                        </>
                      )}
                    </h1>
                    <p className="heading-description">
                      {view === 'rides'
                        ? 'Your upcoming rides, boarding details, and trip history.'
                        : 'Keep your favourite commutes close. Find your next ride faster.'}
                    </p>
                  </div>
                  <div className="heading-note">
                    <Icon name="leaf" size={29} />
                    <span>
                      A shared ride.
                      <br />A lighter city.
                    </span>
                  </div>
                </section>
              )}

              {view === 'find' && (
                <>
                  <section className="journey-grid">
                    <form className="search-card card" onSubmit={search}>
                      <div className="section-title">
                        <h2>{t('whereHeading')}</h2>
                        <Icon name="route" />
                      </div>
                      <JourneyFields
                        journey={journey}
                        corridors={data.corridors}
                        update={updateJourney}
                        departureLabel={t('departureAddisTime')}
                      />
                      <button className="primary full" disabled={busy} type="submit">
                        {busy ? 'Finding your route…' : t('findMyRide')}
                        <Icon name="arrow" size={18} />
                      </button>
                      <button type="button" className="save-link" onClick={() => open('save')}>
                        <Icon name="bookmark" size={15} /> {t('saveThisCommute')}
                      </button>
                    </form>
                    <div
                      className={`journey-map-wrapper ${mapCollapsed ? 'collapsed' : ''}`}
                      style={{
                        height: mapCollapsed ? '180px' : '410px',
                        transition: 'height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden',
                        borderRadius: '16px',
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      <RouteMap
                        corridor={corridor}
                        originId={journey.origin}
                        destinationId={journey.destination}
                        collapsed={mapCollapsed}
                        onToggleCollapse={() => setMapCollapsed(!mapCollapsed)}
                      />
                    </div>
                  </section>
                  {results && (
                    <RideResults
                      trips={results.matches}
                      busy={busy}
                      choose={(trip) => {
                        setSelected(trip);
                        open('booking');
                      }}
                      profile={(trip) => {
                        setSelected(trip);
                        open('driver-profile');
                      }}
                    />
                  )}
                </>
              )}

              {view === 'rides' && (
                <RideRecords
                  bookings={data.bookings}
                  filter={filter}
                  setFilter={setFilter}
                  busy={busy}
                  stopName={stopName}
                  refresh={() =>
                    void run(async () => {
                      await refresh();
                      setNotice('Your rides are up to date.');
                    })
                  }
                  cancel={(id) =>
                    void run(async () => {
                      await api(`/bookings/${id}/action`, 'POST', { action: 'cancel' });
                      await refresh();
                      setNotice('Ride cancelled. Your seats have been released.');
                    })
                  }
                />
              )}
              {view === 'saved' && (
                <SavedCommutes
                  commutes={data.commutes}
                  busy={busy}
                  stopName={stopName}
                  add={() => navigate('find')}
                  use={useCommute}
                  remove={(id) =>
                    void run(async () => {
                      await api(`/commutes/${id}`, 'DELETE');
                      await refresh();
                      setNotice('Commute removed.');
                    })
                  }
                />
              )}
            </>
          )}

          <footer>
            <span className="footer-brand">zew.</span>
            <span>A better everyday, together.</span>
            <button className="text-button" onClick={() => open('help')}>
              How it works
            </button>
            <span className="footer-disclaimer">
              Zew Addis Ababa · Preview environment · No live bookings
            </span>
          </footer>
        </main>
      </div>

      {dialog === 'auth' && (
        <AuthModal
          isOpen
          onClose={() => setDialog(null)}
          onSuccess={() => {
            window.location.href = '/';
          }}
        />
      )}
      {dialog && dialog !== 'auth' && (
        <Modal
          title={
            {
              help: 'Same direction. Shared ride.',
              save: 'Save your everyday route',
              booking: 'Your ride, at a glance',
              account: 'Account & Workspace',
              'driver-profile': `Driver & Vehicle Profile · ${selected?.driver ?? 'Driver'}`,
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
                  'The system checks stop order, departure time, and available seats.',
                ],
                [
                  '03',
                  'Review your preview reservation',
                  'Reserve a seat and wait for your driver to accept. Share your code when you board; your driver starts and completes the ride.',
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
          {dialog === 'driver-profile' && selected && (
            <DriverProfile trip={selected} onChoose={() => setDialog('booking')} />
          )}
          {dialog === 'booking' && selected && (
            <BookingConfirmation
              trip={selected}
              journey={journey}
              stopName={stopName}
              busy={busy}
              searchAgain={() => {
                setDialog(null);
                void search();
              }}
              confirm={() =>
                void run(async () => {
                  await api('/bookings', 'POST', { quoteId: selected.quoteId });
                  await refresh();
                  setResults(undefined);
                  setDialog(null);
                  setView('rides');
                  setFilter('upcoming');
                  setNotice('Your reservation is saved. Waiting for your driver to accept.');
                })
              }
            />
          )}
          {dialog === 'account' && (
            <div className="account-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <span
                  className="avatar"
                  style={{
                    width: 56,
                    height: 56,
                    background: '#eaf4ee',
                    color: '#285943',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}
                >
                  {authUser ? authUser.name[0]?.toUpperCase() : '👤'}
                </span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>
                    {authUser ? authUser.name : 'Personal Workspace'}
                  </h3>
                  <p style={{ margin: 0, color: '#69735f', fontSize: 13 }}>
                    {authUser ? authUser.email : 'Guest Session'}
                  </p>
                </div>
              </div>

              {authUser ? (
                <button
                  type="button"
                  className="danger-link"
                  style={{
                    width: '100%',
                    padding: '12px',
                    textAlign: 'center',
                    background: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                  onClick={handleSignOut}
                >
                  Log out of account
                </button>
              ) : (
                <button type="button" className="primary full" onClick={() => open('auth')}>
                  Sign In / Create Account
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
