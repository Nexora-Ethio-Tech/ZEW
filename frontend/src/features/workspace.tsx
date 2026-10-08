'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon, type IconName } from '@/components/icon';
import { RouteMap } from '@/components/route-map';
import { Modal } from '@/components/modal';
import { signOut } from '@/lib/auth';
import { AuthModal } from './auth/auth-modal';
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
import { getTranslation, type Language, type Theme } from '@/lib/i18n';
import { applyTheme, getStoredTheme } from '@/lib/theme';

type PassengerView = 'find' | 'rides' | 'saved';
type DriverView = 'driver_groups' | 'driver_earnings';
type SupportView = 'support_dispatch' | 'support_radar';
type AdminView = 'admin_overview' | 'admin_drivers' | 'admin_audit';

type View = PassengerView | DriverView | SupportView | AdminView;
type Dialog =
  | 'waitlist'
  | 'help'
  | 'save'
  | 'offer'
  | 'booking'
  | 'board'
  | 'account'
  | 'auth'
  | 'driver-profile'
  | null;

const passengerNavigation: {
  id: PassengerView;
  labelKey: string;
  label: string;
  icon: IconName;
}[] = [
  { id: 'find', labelKey: 'planAhead', label: 'Plan ahead', icon: 'route' },
  { id: 'rides', labelKey: 'myRides', label: 'My rides', icon: 'rides' },
  { id: 'saved', labelKey: 'savedCommutes', label: 'Saved commutes', icon: 'bookmark' },
];

const driverNavigation: { id: DriverView; labelKey: string; label: string; icon: IconName }[] = [
  { id: 'driver_groups', labelKey: 'passengerRequests', label: 'Passenger requests', icon: 'car' },
  {
    id: 'driver_earnings',
    labelKey: 'earningsPayouts',
    label: 'Earnings & Payouts',
    icon: 'wallet',
  },
];

const supportNavigation: { id: SupportView; labelKey: string; label: string; icon: IconName }[] = [
  { id: 'support_dispatch', labelKey: 'phoneDispatch', label: 'Phone Dispatch Desk', icon: 'help' },
  { id: 'support_radar', labelKey: 'liveRadar', label: 'Simulated Driver Radar', icon: 'pin' },
];

const adminNavigation: { id: AdminView; labelKey: string; label: string; icon: IconName }[] = [
  { id: 'admin_overview', labelKey: 'systemOverview', label: 'System Overview', icon: 'shield' },
  {
    id: 'admin_drivers',
    labelKey: 'driverVerification',
    label: 'Driver Verification',
    icon: 'people',
  },
  { id: 'admin_audit', labelKey: 'auditLog', label: 'Live Audit Log', icon: 'clock' },
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const statusLabel = {
  confirmed: 'Seat confirmed',
  in_progress: 'On the way',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function Workspace({
  user,
  onLogout,
}: {
  user?: { id: string; email: string; name: string; role: string } | null;
  onLogout?: () => void;
} = {}) {
  const [data, setData] = useState<Dashboard>();
  const [view, setView] = useState<View>('find');

  const [dialog, setDialog] = useState<Dialog>(null);
  const [journey, setJourney] = useState<Journey & { minSeats: number; maxSeats: number }>({
    corridorId: 'bole-centre',
    origin: 'bole',
    destination: 'meskel',
    departure: '',
    seats: 1,
    minSeats: 1,
    maxSeats: 4,
  });
  const [results, setResults] = useState<Matches>();
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [selected, setSelected] = useState<Trip>();
  const [boarding, setBoarding] = useState<Booking>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [driverActive, setDriverActive] = useState(true);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const active = getStoredTheme();
    setTheme(active);
    applyTheme(active);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const t = (key: string) => getTranslation(lang, key);

  const authUser = user ? { ...user, emailConfirmed: true } : null;
  const authBusy = false;

  // Support dispatch state
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [dispatchOrders, setDispatchOrders] = useState<
    { id: string; caller: string; phone: string; route: string; code: string; status: string }[]
  >([]);

  // Active Role Identifiers
  const isDriver = view.startsWith('driver');
  const isSupport = view.startsWith('support');
  const isAdmin = view.startsWith('admin');
  const isPassenger = !isDriver && !isSupport && !isAdmin;

  const roleMeta = isDriver
    ? { name: 'Driver Mode', icon: '🚗', bg: '#1b4d3e', color: '#fff' }
    : isSupport
      ? { name: 'Customer Support', icon: '🎧', bg: '#e8f0fe', color: '#1a73e8' }
      : isAdmin
        ? { name: 'Administrator', icon: '🛡️', bg: '#fef3c7', color: '#92400e' }
        : { name: 'Passenger Mode', icon: '👤', bg: '#eaf4ee', color: '#285943' };

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
      setResults(await api<Matches>('/matches', 'POST', activeJourney));
      setMapCollapsed(true);
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
      new Map((data?.corridors || []).flatMap((c) => c.stops).map((s) => [s.id, s])).values(),
    );

    const selectedStop = allStops.find((s) => s.id === value);
    const displayValue = focused ? query : selectedStop?.name || '';

    const matches = query
      ? allStops.filter(
          (s) =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.area?.toLowerCase().includes(query.toLowerCase()),
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
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 16,
            }}
          />
        </span>
        {focused && (
          <div
            className="place-results"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 10,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 8,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                className="place-result"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid #eee',
                }}
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
    const allStops = (data?.corridors || []).flatMap((c) => c.stops);
    const originStop = allStops.find((s) => s.id === journey.origin);
    const destStop = allStops.find((s) => s.id === journey.destination);

    let distanceKm = 4.2;
    if (originStop?.latitude && destStop?.latitude) {
      const calcDist = getDistanceKm(
        originStop.latitude,
        originStop.longitude,
        destStop.latitude,
        destStop.longitude,
      );
      if (calcDist > 0.3) distanceKm = calcDist;
    }

    const maxCapacity = Math.max(1, journey.maxSeats || 4);
    const minCapacity = Math.max(1, Math.min(journey.minSeats || 1, maxCapacity));

    // Dynamic vehicle tier multiplier based on capacity
    const vehicleTier =
      maxCapacity > 8 ? 'Coaster / Bus' : maxCapacity > 4 ? 'Minivan' : 'Sedan Car';
    const vehicleMultiplier = maxCapacity > 8 ? 1.5 : maxCapacity > 4 ? 1.25 : 1.0;

    // Dynamic Base Trip Solo Total (Calculated dynamically per route length & vehicle type)
    const baseSoloFare = Math.max(100, Math.round((distanceKm * 40 + 90) * vehicleMultiplier));

    // Generate dynamic sample passenger counts up to maxCapacity
    const samplePassengerCounts: number[] = [];
    if (maxCapacity <= 4) {
      for (let i = 1; i <= maxCapacity; i++) samplePassengerCounts.push(i);
    } else {
      const step = Math.max(1, Math.floor(maxCapacity / 4));
      samplePassengerCounts.push(1);
      for (let i = Math.max(2, minCapacity); i < maxCapacity; i += step) {
        if (!samplePassengerCounts.includes(i)) samplePassengerCounts.push(i);
      }
      if (!samplePassengerCounts.includes(maxCapacity)) samplePassengerCounts.push(maxCapacity);
    }

    return (
      <>
        <div className="route-inputs">
          <StopField
            label="Pickup"
            value={journey.origin}
            onChange={(origin) => {
              const matching =
                data!.corridors.find(
                  (c) =>
                    c.stops.some((s) => s.id === origin) &&
                    c.stops.some((s) => s.id === journey.destination),
                ) ||
                data!.corridors.find((c) => c.stops.some((s) => s.id === origin)) ||
                data!.corridors[0];
              updateJourney({ origin, corridorId: matching.id });
            }}
          />
          <button
            type="button"
            className="swap-button"
            aria-label="Swap pickup and destination"
            onClick={() => {
              const origin = journey.destination;
              const destination = journey.origin;
              const matching =
                data!.corridors.find(
                  (c) =>
                    c.stops.some((s) => s.id === origin) &&
                    c.stops.some((s) => s.id === destination),
                ) ||
                data!.corridors.find((c) => c.stops.some((s) => s.id === origin)) ||
                data!.corridors[0];
              updateJourney({ origin, destination, corridorId: matching.id });
            }}
          >
            <Icon name="swap" size={16} />
          </button>
          <StopField
            label="Drop-off"
            value={journey.destination}
            onChange={(destination) => {
              const matching =
                data!.corridors.find(
                  (c) =>
                    c.stops.some((s) => s.id === journey.origin) &&
                    c.stops.some((s) => s.id === destination),
                ) ||
                data!.corridors.find((c) => c.stops.some((s) => s.id === destination)) ||
                data!.corridors[0];
              updateJourney({ destination, corridorId: matching.id });
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <label className="field" style={{ width: '100%', marginBottom: 0 }}>
            {t('departureAddisTime')}
            <input
              aria-label="Departure time"
              required
              type="datetime-local"
              value={journey.departure ? localDeparture(journey.departure) : ''}
              onChange={(e) => {
                if (e.target.value) updateJourney({ departure: `${e.target.value}:00+03:00` });
              }}
              style={{ height: 38, padding: '0 8px', fontSize: 12 }}
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7a8276' }}>
              {t('capacityRange')} ({minCapacity}–{maxCapacity})
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input
                type="number"
                min={1}
                max={maxCapacity}
                title="Minimum passengers"
                value={journey.minSeats || 1}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  const maxVal = Math.max(journey.maxSeats || 4, val);
                  updateJourney({ minSeats: val, maxSeats: maxVal, seats: val } as any);
                }}
                style={{
                  height: 38,
                  padding: '0 6px',
                  fontSize: 12,
                  fontWeight: '700',
                  borderRadius: 6,
                  border: '1px solid #d2dccb',
                  background: '#fff',
                  color: '#285943',
                }}
              />
              <input
                type="number"
                min={minCapacity}
                max={50}
                title="Maximum passengers"
                value={journey.maxSeats || 4}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  const minVal = Math.min(journey.minSeats || 1, val);
                  updateJourney({ minSeats: minVal, maxSeats: val } as any);
                }}
                style={{
                  height: 38,
                  padding: '0 6px',
                  fontSize: 12,
                  fontWeight: '700',
                  borderRadius: 6,
                  border: '1px solid #d2dccb',
                  background: '#fff',
                  color: '#285943',
                }}
              />
            </div>
          </div>
        </div>

        {/* DYNAMIC MONEY DIFFERENCE & FARE COMPARISON MATRIX */}
        <div style={{ marginTop: 10, borderTop: '1px solid #e2e8dc', paddingTop: 8 }}>
          <div
            style={{
              background: '#f4f8f3',
              border: '1px solid #cfdcc8',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1f4835' }}>
                💰 {t('dynamicFareBreakdown')} ({vehicleTier})
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#285943',
                  background: '#dcecdb',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 600,
                }}
              >
                {distanceKm} km · Solo total: {baseSoloFare} ETB
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(4, samplePassengerCounts.length)}, 1fr)`,
                gap: 6,
                textAlign: 'center',
              }}
            >
              {samplePassengerCounts.map((count) => {
                const farePerPerson = Math.round(baseSoloFare / count);
                const savings = baseSoloFare - farePerPerson;
                const pct = Math.round((savings / baseSoloFare) * 100);
                const inSelectedRange = count >= minCapacity && count <= maxCapacity;
                const isCurrentSeats = (journey.minSeats || 1) === count;
                const icon =
                  count === 1
                    ? '👤'
                    : count === 2
                      ? '👥'
                      : count <= 4
                        ? '🧑‍🤝‍🧑'
                        : count <= 8
                          ? '🚐'
                          : '🚌';
                const label =
                  count === 1
                    ? 'Solo'
                    : count === 2
                      ? 'Pair'
                      : count === 3
                        ? 'Trio'
                        : count === 4
                          ? 'Full car'
                          : `${count} seats`;

                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...journey,
                        seats: 1,
                        minSeats: count,
                        maxSeats: Math.max(count, journey.maxSeats || 4),
                      };
                      updateJourney(updated as any);
                      if (results) {
                        void run(async () => {
                          setResults(await api<Matches>('/matches', 'POST', updated));
                        });
                      }
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: 8,
                      border: isCurrentSeats
                        ? '2px solid #285943'
                        : inSelectedRange
                          ? '1px solid #8eb596'
                          : '1px solid #e1e7dc',
                      background: isCurrentSeats
                        ? '#285943'
                        : inSelectedRange
                          ? '#e9f4eb'
                          : '#fafcf9',
                      color: isCurrentSeats ? '#fff' : '#333',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      opacity: inSelectedRange ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontSize: 16 }}>{icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>
                      {farePerPerson} <small style={{ fontSize: 9 }}>ETB</small>
                    </div>
                    {savings > 0 ? (
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          marginTop: 3,
                          color: isCurrentSeats ? '#a7f3d0' : '#15803d',
                          background: isCurrentSeats ? 'rgba(0,0,0,0.25)' : '#dcfce7',
                          padding: '2px 4px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        -{savings} ETB ({pct}%)
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>Solo rate</div>
                    )}
                  </button>
                );
              })}
            </div>

            {maxCapacity > minCapacity && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: '#1f4835',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#e4f1e5',
                  padding: '6px 10px',
                  borderRadius: 6,
                }}
              >
                <span>💡</span>
                <span>
                  <strong>Money Savings:</strong> Sharing your {distanceKm} km route with{' '}
                  <strong>{maxCapacity} passengers</strong> drops fare per person from{' '}
                  <strong>{baseSoloFare} ETB</strong> to{' '}
                  <strong>{Math.round(baseSoloFare / maxCapacity)} ETB</strong> — saving{' '}
                  <strong>
                    {baseSoloFare - Math.round(baseSoloFare / maxCapacity)} ETB (
                    {Math.round(
                      ((baseSoloFare - Math.round(baseSoloFare / maxCapacity)) / baseSoloFare) *
                        100,
                    )}
                    %)
                  </strong>
                  !
                </span>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const completedDriverFare = data?.demoEarnings.totalFare ?? 0;

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
        <p className="sidebar-demo-label">PRIVATE DEMO · SIMULATED RIDES</p>
        <div className="city-label">
          <span className="live-dot" /> ADDIS ABABA
        </div>
        <p className="nav-heading">
          {isDriver
            ? 'DRIVER CONSOLE'
            : isSupport
              ? 'SUPPORT DESK'
              : isAdmin
                ? 'ADMINISTRATION'
                : 'YOUR EVERYDAY JOURNEY'}
        </p>
        <nav aria-label="Main navigation">
          {isDriver
            ? driverNavigation.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${view === item.id ? 'selected' : ''}`}
                  onClick={() => navigate(item.id)}
                  aria-current={view === item.id ? 'page' : undefined}
                >
                  <Icon name={item.icon} />
                  <span>{t(item.labelKey)}</span>
                </button>
              ))
            : isSupport
              ? supportNavigation.map((item) => (
                  <button
                    key={item.id}
                    className={`nav-item ${view === item.id ? 'selected' : ''}`}
                    onClick={() => navigate(item.id)}
                    aria-current={view === item.id ? 'page' : undefined}
                  >
                    <Icon name={item.icon} />
                    <span>{t(item.labelKey)}</span>
                  </button>
                ))
              : isAdmin
                ? adminNavigation.map((item) => (
                    <button
                      key={item.id}
                      className={`nav-item ${view === item.id ? 'selected' : ''}`}
                      onClick={() => navigate(item.id)}
                      aria-current={view === item.id ? 'page' : undefined}
                    >
                      <Icon name={item.icon} />
                      <span>{t(item.labelKey)}</span>
                    </button>
                  ))
                : passengerNavigation.map((item) => (
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
            onClick={() => navigate(isDriver ? 'find' : 'driver_groups')}
          >
            <Icon name={isDriver ? 'people' : 'car'} />
            {isDriver ? 'Switch to Passenger Mode' : 'Switch to Driver Mode'}
          </button>
          <button
            className="nav-item"
            onClick={() => open('account')}
            aria-label="Demo workspace controls"
          >
            <Icon name="people" /> Demo controls
          </button>
          <button className="nav-item help-button" onClick={() => open('help')}>
            <Icon name="help" />
            How Zew works
          </button>
        </div>
      </aside>

      <div className="page-shell">
        <header className="topbar">
          <div className="topbar-left">
            <span
              className="topbar-slogan"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#1c4d36',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="sun" size={16} /> Wherever you’re going,{' '}
              <em style={{ fontStyle: 'italic', color: '#2e7d59', fontWeight: 800 }}>
                go together.
              </em>
            </span>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Language Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                padding: '4px 10px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
              }}
            >
              <span style={{ fontSize: 13 }}>🌐</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                aria-label="Select Language"
              >
                <option value="en">English</option>
                <option value="am">አማርኛ</option>
                <option value="om">Afaan Oromoo</option>
              </select>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
              }}
              title="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    fontSize: 12,
                  }}
                >
                  <strong style={{ color: '#1b3d2b', fontWeight: 800 }}>{user.name}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    {user.role} ({user.email})
                  </span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {t('signOut')}
                  </button>
                )}
              </div>
            ) : authUser ? (
              <button
                className="topbar-avatar"
                onClick={() => open('account')}
                aria-label="Account details"
                title={`Logged in as ${authUser.name} (${authUser.email})`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  background: '#285943',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                {authUser.name[0]?.toUpperCase() || 'U'}
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => open('auth')}
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Sign In / Sign Up
              </button>
            )}
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
          ) : isPassenger ? (
            /* PASSENGER VIEWS */
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
                      {routeFields()}
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
                              <button
                                type="button"
                                className="driver-profile-trigger"
                                onClick={() => {
                                  setSelected(trip);
                                  open('driver-profile');
                                }}
                                title="Click to view driver profile & car details"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  padding: '4px',
                                  borderRadius: '12px',
                                  transition: 'background 0.2s ease',
                                }}
                              >
                                <span className={`avatar driver-avatar tone-${index}`}>
                                  {trip.driver[0]}
                                </span>
                                <div className="driver-details">
                                  <strong>
                                    {trip.driver}{' '}
                                    <span
                                      className="sample-label"
                                      style={{
                                        background: '#e0f2fe',
                                        color: '#0369a1',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Sample driver · simulated profile
                                    </span>
                                  </strong>
                                  <span
                                    style={{
                                      color: '#2563eb',
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    {trip.vehicle}
                                  </span>
                                  <small>
                                    <Icon name="route" size={13} /> Same direction ·{' '}
                                    {trip.availableSeats} seats left
                                  </small>
                                </div>
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
                            depart around your requested time.
                          </p>
                        </div>
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
                                <span>Show this 4-digit code to your driver when boarding.</span>
                              </div>
                            ) : (
                              <p>
                                {b.status === 'completed'
                                  ? 'Demo payment recorded. No money was charged.'
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
                </>
              )}

              {view === 'saved' && (
                <>
                  <div className="content-toolbar">
                    <p className="muted">{data.commutes.length} of 10 commutes saved</p>
                    <button
                      className="secondary"
                      onClick={() => {
                        navigate('find');
                        setNotice(
                          'Select your pickup, drop-off & departure time, then tap "Save this commute".',
                        );
                      }}
                    >
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
                </>
              )}
            </>
          ) : isDriver ? (
            /* DRIVER VIEWS */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> DRIVER CONSOLE · ADDIS ABABA
                  </p>
                  <h1>
                    {view === 'driver_groups' ? (
                      <>
                        Share your drive.
                        <br />
                        <em>Pick up commuters on your route.</em>
                      </>
                    ) : (
                      <>
                        Automated payouts.
                        <br />
                        <em>Track your earnings.</em>
                      </>
                    )}
                  </h1>
                </div>
                <div className="heading-note">
                  <Icon name="car" size={29} />
                  <span>Driver Console</span>
                </div>
              </section>

              {/* DRIVER ONLINE / OFFLINE ACTIVATION STATUS BANNER */}
              <div
                className="card"
                style={{
                  maxWidth: 840,
                  margin: '0 auto 24px',
                  padding: '16px 20px',
                  background: driverActive ? '#f0fdf4' : '#fff1f2',
                  border: driverActive ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: driverActive ? '#22c55e' : '#ef4444',
                      boxShadow: driverActive
                        ? '0 0 0 4px rgba(34, 197, 94, 0.2)'
                        : '0 0 0 4px rgba(239, 68, 68, 0.2)',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <strong
                      style={{
                        fontSize: 14,
                        color: driverActive ? '#15803d' : '#b91c1c',
                        display: 'block',
                      }}
                    >
                      {driverActive
                        ? '🟢 DRIVER STATUS: ONLINE & ACTIVE'
                        : '🔴 DRIVER STATUS: OFFLINE & INACTIVE'}
                    </strong>
                    <span style={{ fontSize: 12, color: driverActive ? '#166534' : '#991b1b' }}>
                      {driverActive
                        ? 'You are online and accepting commuter requests on your active route. Shown only in this simulated workspace.'
                        : 'This sample driver is inactive in your private demo. No real riders or dispatchers see this view.'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !driverActive;
                    setDriverActive(nextState);
                    setNotice(
                      nextState
                        ? 'Driver status set to ONLINE & ACTIVE.'
                        : 'Driver status set to OFFLINE.',
                    );
                  }}
                  style={{
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: 'none',
                    background: driverActive ? '#dc2626' : '#285943',
                    color: '#fff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {driverActive ? 'Deactivate (Go Offline)' : 'Activate (Go Online)'}
                </button>
              </div>

              {view === 'driver_groups' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <div className="card" style={{ marginBottom: 32, padding: 24 }}>
                    <div className="section-title">
                      <h2>Active Ride Management</h2>
                      <Icon name="car" />
                    </div>
                    {data.bookings.length > 0 ? (
                      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                        {data.bookings.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              border: '1px solid #e1e3de',
                              borderRadius: 10,
                              padding: 16,
                              background: b.status === 'in_progress' ? '#eaffef' : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 4,
                                }}
                              >
                                <span className={`status-pill ${b.status}`}>
                                  {statusLabel[b.status]}
                                </span>
                                <strong style={{ fontSize: 16 }}>
                                  {stopName(b.origin)} → {stopName(b.destination)}
                                </strong>
                              </div>
                              <p style={{ margin: 0, fontSize: 14, color: '#69735f' }}>
                                Rider: {b.driver} · {b.seats} seat(s) · {time(b.departure)} EAT
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <strong style={{ fontSize: 18, color: '#285943' }}>
                                {b.fare} ETB
                              </strong>
                              {b.status === 'confirmed' && (
                                <button
                                  className="primary"
                                  onClick={() => {
                                    setBoarding(b);
                                    open('board');
                                  }}
                                >
                                  Enter boarding code
                                </button>
                              )}
                              {b.status === 'in_progress' && (
                                <button
                                  className="primary"
                                  disabled={busy}
                                  style={{ background: '#285943' }}
                                  onClick={() =>
                                    void run(async () => {
                                      await api(`/bookings/${b.id}/action`, 'POST', {
                                        action: 'complete',
                                      });
                                      await refresh();
                                      setNotice(`Trip completed! ${b.fare} ETB simulated receipt.`);
                                    })
                                  }
                                >
                                  Complete demo trip
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#69735f', margin: '16px 0 0' }}>
                        No active passenger reservations.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {view === 'driver_earnings' && (
                <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 0' }}>
                  <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3>Your simulated receipt summary</h3>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                        marginTop: 16,
                      }}
                    >
                      <div>
                        <small style={{ color: '#69735f', display: 'block' }}>
                          Completed demo fares
                        </small>
                        <strong style={{ fontSize: 24 }}>{completedDriverFare} ETB</strong>
                      </div>
                      <div>
                        <small style={{ color: '#69735f', display: 'block' }}>
                          Example platform share
                        </small>
                        <strong style={{ fontSize: 24 }}>
                          {data.demoEarnings.platformFee} ETB
                        </strong>
                      </div>
                      <div>
                        <small style={{ color: '#69735f', display: 'block' }}>
                          Simulated driver payout
                        </small>
                        <strong style={{ fontSize: 24 }}>
                          {data.demoEarnings.driverPayout} ETB
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : isSupport ? (
            /* CUSTOMER SUPPORT VIEWS */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> SUPPORT DESK · CALL-IN DISPATCH
                  </p>
                  <h1>
                    {view === 'support_dispatch' ? (
                      <>
                        Call-in Ride Dispatch.
                        <br />
                        <em>Order rides for callers over the phone.</em>
                      </>
                    ) : (
                      <>
                        Simulated Driver Radar.
                        <br />
                        <em>Track active fleet locations.</em>
                      </>
                    )}
                  </h1>
                </div>
                <div className="heading-note">
                  <Icon name="help" size={29} />
                  <span>Support Desk</span>
                </div>
              </section>

              {view === 'support_dispatch' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <form
                    className="card"
                    style={{ padding: 24, marginBottom: 32 }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!callerName || !callerPhone) {
                        setError('Please enter caller name and phone number');
                        return;
                      }
                      await run(async () => {
                        const activeDeparture =
                          !journey.departure ||
                          Date.parse(journey.departure) <= Date.now() - 5 * 60000
                            ? new Date(Date.now() + 15 * 60000).toISOString()
                            : journey.departure;
                        const activeJourney = { ...journey, departure: activeDeparture };
                        const searchResults = await api<Matches>('/matches', 'POST', activeJourney);
                        const match = searchResults.matches[0];
                        if (!match) {
                          setError('No drivers available on this corridor for caller.');
                          return;
                        }
                        const bookingRes = await api<Booking>('/bookings', 'POST', {
                          ...activeJourney,
                          tripId: match.id,
                        });
                        await refresh();
                        setDispatchOrders((prev) => [
                          {
                            id: bookingRes.id,
                            caller: callerName,
                            phone: callerPhone,
                            route: `${stopName(journey.origin)} → ${stopName(journey.destination)}`,
                            code: bookingRes.code,
                            status: 'Confirmed & Dispatched',
                          },
                          ...prev,
                        ]);
                        setCallerName('');
                        setCallerPhone('');
                        setNotice(
                          `Ride dispatched for ${callerName}! Boarding code: ${bookingRes.code}`,
                        );
                      });
                    }}
                  >
                    <div className="section-title" style={{ marginBottom: 16 }}>
                      <h2>Create Phone Ride Order</h2>
                      <Icon name="help" />
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                        marginBottom: 16,
                      }}
                    >
                      <label className="field">
                        Caller Name
                        <input
                          type="text"
                          required
                          placeholder="e.g. Abebech Kebede"
                          value={callerName}
                          onChange={(e) => setCallerName(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Caller Phone Number
                        <input
                          type="tel"
                          required
                          placeholder="+251 911 234 567"
                          value={callerPhone}
                          onChange={(e) => setCallerPhone(e.target.value)}
                        />
                      </label>
                    </div>
                    {routeFields()}
                    <button
                      className="primary full"
                      type="submit"
                      disabled={busy}
                      style={{ marginTop: 20 }}
                    >
                      {busy ? 'Dispatching...' : 'Dispatch Ride & Generate Code'}
                      <Icon name="arrow" size={18} />
                    </button>
                  </form>

                  <div className="card" style={{ padding: 24 }}>
                    <h3>Recent Phone Dispatch Queue</h3>
                    {dispatchOrders.length > 0 ? (
                      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                        {dispatchOrders.map((order) => (
                          <div
                            key={order.id}
                            style={{
                              border: '1px solid #e1e3de',
                              borderRadius: 8,
                              padding: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong>
                                {order.caller} ({order.phone})
                              </strong>
                              <br />
                              <small style={{ color: '#69735f' }}>Route: {order.route}</small>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  background: '#eaffef',
                                  color: '#285943',
                                  padding: '4px 8px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 'bold',
                                }}
                              >
                                Code: {order.code}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#69735f', margin: '12px 0 0' }}>
                        No phone dispatch orders created in this session.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {view === 'support_radar' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <div className="section-title" style={{ marginBottom: 16 }}>
                    <h2>Simulated Driver Radar</h2>
                    <span className="muted">Addis Ababa active driver fleet</span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {[
                      {
                        name: 'Hana T.',
                        vehicle: 'Toyota Vitz · Silver',
                        corridor: 'Bole → City centre',
                        seats: '4 seats open',
                      },
                      {
                        name: 'Dawit M.',
                        vehicle: 'Suzuki Dzire · White',
                        corridor: 'Bole → City centre',
                        seats: '3 seats open',
                      },
                      {
                        name: 'Selam A.',
                        vehicle: 'Toyota Yaris · Blue',
                        corridor: 'CMC → City centre',
                        seats: '4 seats open',
                      },
                      {
                        name: 'Abebe K.',
                        vehicle: 'Hyundai Atos · Red',
                        corridor: 'Bole → City centre',
                        seats: '4 seats open',
                      },
                      {
                        name: 'Ermias K.',
                        vehicle: 'Hyundai Elantra · Silver',
                        corridor: 'CMC → City centre',
                        seats: '3 seats open',
                      },
                    ].map((driver, i) => (
                      <div key={i} className="card" style={{ padding: 16 }}>
                        <strong style={{ fontSize: 16 }}>{driver.name}</strong>
                        <p style={{ margin: '4px 0', fontSize: 13, color: '#69735f' }}>
                          {driver.vehicle}
                        </p>
                        <small
                          style={{
                            display: 'block',
                            color: '#285943',
                            fontWeight: 'bold',
                            marginBottom: 8,
                          }}
                        >
                          {driver.corridor}
                        </small>
                        <span
                          style={{
                            background: '#eaffef',
                            color: '#285943',
                            padding: '4px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        >
                          {driver.seats}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ADMINISTRATOR VIEWS */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">
                    <span /> SYSTEM ADMINISTRATOR · CONTROL CENTER
                  </p>
                  <h1>
                    {view === 'admin_overview' ? (
                      <>
                        System Overview.
                        <br />
                        <em>Operations and platform metrics.</em>
                      </>
                    ) : view === 'admin_drivers' ? (
                      <>
                        Sample Driver Profiles.
                        <br />
                        <em>Fleet verification management.</em>
                      </>
                    ) : (
                      <>
                        Live Audit Trail.
                        <br />
                        <em>Private demo activity log.</em>
                      </>
                    )}
                  </h1>
                </div>
                <div className="heading-note">
                  <Icon name="shield" size={29} />
                  <span>Admin Console</span>
                </div>
              </section>

              {view === 'admin_overview' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 16,
                      marginBottom: 32,
                    }}
                  >
                    <div className="card" style={{ padding: 16 }}>
                      <small style={{ color: '#69735f' }}>Total Commutes</small>
                      <h3 style={{ margin: '4px 0 0', fontSize: 24 }}>
                        {148 + data.bookings.length}
                      </h3>
                    </div>
                    <div className="card" style={{ padding: 16 }}>
                      <small style={{ color: '#69735f' }}>Active Drivers</small>
                      <h3 style={{ margin: '4px 0 0', fontSize: 24 }}>12 Drivers</h3>
                    </div>
                    <div className="card" style={{ padding: 16 }}>
                      <small style={{ color: '#69735f' }}>Platform Fees (10%)</small>
                      <h3 style={{ margin: '4px 0 0', fontSize: 24 }}>
                        {Math.round(completedDriverFare * 0.1)} ETB
                      </h3>
                    </div>
                    <div className="card" style={{ padding: 16 }}>
                      <small style={{ color: '#69735f' }}>API Health</small>
                      <h3 style={{ margin: '4px 0 0', fontSize: 16, color: '#285943' }}>
                        🟢 Operational
                      </h3>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 24 }}>
                    <h3>Configured Active Corridors</h3>
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      {data.corridors.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '12px 0',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          <div>
                            <strong>{c.name}</strong>
                            <br />
                            <small style={{ color: '#69735f' }}>
                              {c.stops.length} Stops ({c.stops[0].name} →{' '}
                              {c.stops[c.stops.length - 1].name})
                            </small>
                          </div>
                          <span style={{ color: '#285943', fontWeight: 'bold' }}>Active Route</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {view === 'admin_drivers' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <div className="card" style={{ padding: 24 }}>
                    <h3>Sample Driver Profiles</h3>
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      {[
                        {
                          name: 'Hana T.',
                          vehicle: 'Toyota Vitz · Silver',
                          license: 'ET-AA-40192',
                          status: 'Demo profile',
                        },
                        {
                          name: 'Dawit M.',
                          vehicle: 'Suzuki Dzire · White',
                          license: 'ET-AA-91823',
                          status: 'Demo profile',
                        },
                        {
                          name: 'Selam A.',
                          vehicle: 'Toyota Yaris · Blue',
                          license: 'ET-AA-38192',
                          status: 'Demo profile',
                        },
                        {
                          name: 'Tigist W.',
                          vehicle: 'Nissan Note · Grey',
                          license: 'ET-AA-72819',
                          status: 'Demo profile',
                        },
                        {
                          name: 'Maron B.',
                          vehicle: 'Toyota Rush · Black',
                          license: 'ET-AA-10928',
                          status: 'Pending Review',
                        },
                      ].map((driver, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 0',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          <div>
                            <strong>{driver.name}</strong> ({driver.vehicle})
                            <br />
                            <small style={{ color: '#69735f' }}>License: {driver.license}</small>
                          </div>
                          <div>
                            <span
                              style={{
                                background:
                                  driver.status === 'Demo profile' ? '#eaffef' : '#fff3cd',
                                color: driver.status === 'Demo profile' ? '#285943' : '#856404',
                                padding: '4px 10px',
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 'bold',
                              }}
                            >
                              {driver.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {view === 'admin_audit' && (
                <div style={{ maxWidth: 840, margin: '0 auto' }}>
                  <div className="card" style={{ padding: 24 }}>
                    <h3>Live API Audit Events Stream</h3>
                    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                      {data.events && data.events.length > 0 ? (
                        data.events.map((ev, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '10px 0',
                              borderBottom: '1px solid #eee',
                              fontSize: 14,
                            }}
                          >
                            <div>
                              <strong style={{ color: '#285943' }}>{ev.kind}</strong>
                              <span style={{ color: '#69735f', marginLeft: 12 }}>
                                Entity: {ev.entityId}
                              </span>
                            </div>
                            <small style={{ color: '#69735f' }}>{ev.createdAt}</small>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: '#69735f', margin: 0 }}>No audit events logged yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <footer>
            <span className="footer-brand">zew.</span>
            <span>A better everyday, together.</span>
            <button className="text-button" onClick={() => open('help')}>
              How it works
            </button>
            <button className="text-button" onClick={() => open('waitlist')}>
              {data?.waitlistJoined ? 'Registration saved' : 'Join the pilot'}
            </button>
            <span className="footer-disclaimer">Zew Addis Ababa · Private ride demo</span>
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
              waitlist: 'Be part of the first chapter.',
              help: 'Same direction. Shared ride.',
              save: 'Save your everyday route',
              offer: 'Offer a seat on your route',
              booking: 'Your ride, at a glance',
              board: 'Ready to board?',
              account: 'Account & Workspace',
              'driver-profile': `Driver & Vehicle Profile · ${selected?.driver ?? 'Driver'}`,
            }[dialog]!
          }
          close={() => {
            if (!busy && !authBusy) setDialog(null);
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
            <div className="driver-profile-modal">
              {/* Driver Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  background: '#f4f7f2',
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                  border: '1px solid #e2ebd8',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <span
                    className="avatar driver-avatar tone-0"
                    style={{ width: 60, height: 60, fontSize: 22, borderRadius: 18 }}
                  >
                    {selected.driver[0]}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      background: '#2e7d32',
                      border: '2px solid white',
                      borderRadius: '50%',
                    }}
                    title="Simulated profile"
                  />
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      color: '#1b3b2b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {selected.driver}
                    <span
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      Sample demo driver
                    </span>
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#456b38', fontWeight: 600 }}>
                    4.9 ★ Rating · 148 Shared Journeys Completed
                  </p>
                  <span style={{ fontSize: '11px', color: '#69735f' }}>
                    Sample profile · no identity or license verification
                  </span>
                </div>
              </div>

              {/* Vehicle Visual Specs Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: 'white',
                  padding: 18,
                  borderRadius: 18,
                  marginBottom: 16,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        fontWeight: 700,
                      }}
                    >
                      ASSIGNED DEMO VEHICLE
                    </span>
                    <h4
                      style={{ margin: '2px 0 0', fontSize: 20, color: '#38bdf8', fontWeight: 800 }}
                    >
                      {selected.vehicle}
                    </h4>
                  </div>
                  <span
                    style={{
                      background: '#334155',
                      color: '#e2e8f0',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: '1px solid #475569',
                    }}
                  >
                    AA 2-B4091
                  </span>
                </div>

                {/* Car Features */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <span
                    style={{
                      background: '#1e3a8a33',
                      border: '1px solid #3b82f644',
                      color: '#93c5fd',
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 20,
                    }}
                  >
                    ❄️ Air Conditioned
                  </span>
                  <span
                    style={{
                      background: '#064e3b33',
                      border: '1px solid #10b98144',
                      color: '#6ee7b7',
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 20,
                    }}
                  >
                    🧹 Clean & Sanitized
                  </span>
                  <span
                    style={{
                      background: '#78350f33',
                      border: '1px solid #f59e0b44',
                      color: '#fde68a',
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 20,
                    }}
                  >
                    🚭 Non-Smoking
                  </span>
                  <span
                    style={{
                      background: '#4c1d9533',
                      border: '1px solid #8b5cf644',
                      color: '#c4b5fd',
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 20,
                    }}
                  >
                    🧳 Luggage Space (2 Bags)
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: '#cbd5e1',
                  }}
                >
                  <span>Corridor: {corridor?.name ?? 'Addis Commute Corridor'}</span>
                  <span>
                    Seats Open:{' '}
                    <strong>
                      {selected.availableSeats} / {selected.seats}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Corridor Route Info */}
              <div
                style={{
                  background: '#fafbf9',
                  border: '1px solid #e5ebe1',
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: '#556353' }}>Departure Time:</span>
                  <strong style={{ color: '#1b3b2b' }}>
                    {day(selected.departure)} · {time(selected.departure)} EAT
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#556353' }}>Passenger Seat Rate:</span>
                  <strong style={{ color: '#285943', fontSize: 15 }}>
                    {selected.fare} ETB / seat
                  </strong>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDialog(null)}
                >
                  Close Profile
                </button>
                <button
                  type="button"
                  className="primary"
                  style={{ flex: 2 }}
                  onClick={() => {
                    setDialog('booking');
                  }}
                >
                  Reserve Seat ({selected.fare} ETB)
                  <Icon name="arrow" size={17} />
                </button>
              </div>
            </div>
          )}

          {dialog === 'booking' && selected && (
            <div>
              {/* Passenger Role Banner */}
              <div
                style={{
                  background: '#eef5ec',
                  border: '1px solid #cce3cb',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#285943',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'block',
                  }}
                >
                  YOUR ROLE IN THIS TRIP
                </span>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}
                >
                  <span style={{ fontSize: '20px' }}>👤</span>
                  <div>
                    <strong style={{ color: '#1b3b2b', fontSize: '15px', display: 'block' }}>
                      Passenger (Reserving 1 Seat for Yourself)
                    </strong>
                    <span style={{ fontSize: '12px', color: '#456b38' }}>
                      You are taking 1 seat in {selected.driver}'s shared vehicle corridor.
                    </span>
                  </div>
                </div>
              </div>

              <p className="modal-description">
                {stopName(journey.origin)} → {stopName(journey.destination)}
              </p>
              <div className="booking-summary">
                <p>
                  <span>Sample driver</span>
                  <strong>
                    {selected.driver} <span className="sample-label">Sample</span>
                  </strong>
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
                  <span>Seat Share Rate</span>
                  <strong>{selected.fare} ETB / seat</strong>
                </p>
                <p>
                  <span>Your reserved seats</span>
                  <strong>1 seat (Single Passenger)</strong>
                </p>
                <p className="total" style={{ borderTop: '2px solid #285943', paddingTop: '10px' }}>
                  <span>YOUR PASSENGER SEAT FARE</span>
                  <strong style={{ color: '#285943', fontSize: '22px' }}>
                    {selected.fare} ETB
                  </strong>
                </p>
              </div>

              <p
                style={{
                  fontSize: '11px',
                  color: '#556353',
                  margin: '12px 0 16px',
                  textAlign: 'center',
                  background: '#f8faf7',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #e2ebe1',
                }}
              >
                Illustrative demo fare: {selected.fare} ETB for your 1 seat in {selected.driver}'s
                car. The rest of the vehicle seats are shared with other corridor commuters.
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
                    setNotice('Your seat is confirmed. Your boarding code is in My rides.');
                  })
                }
              >
                {busy ? 'Reserving…' : 'Confirm demo reservation'}
                <Icon name="check" size={17} />
              </button>
            </div>
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
                  setNotice('Boarding code confirmed. Journey is underway.');
                });
              }}
            >
              <p className="modal-description">
                Enter the rider’s 4-digit boarding code to verify passenger boarding.
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

          {dialog === 'account' && (
            <div className="account-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <span
                  className="avatar"
                  style={{
                    width: 56,
                    height: 56,
                    background: roleMeta.bg,
                    color: roleMeta.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}
                >
                  {authUser ? authUser.name[0]?.toUpperCase() : roleMeta.icon}
                </span>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>
                    {authUser ? authUser.name : 'Personal Workspace'}
                  </h3>
                  <p style={{ margin: 0, color: '#69735f', fontSize: 13 }}>
                    {authUser ? authUser.email : 'Guest Session'}
                    {authUser?.emailConfirmed && (
                      <span style={{ color: '#285943', fontWeight: 'bold', marginLeft: 6 }}>
                        Sample
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div
                className="role-toggle"
                style={{ marginBottom: 20, background: '#f8f8ee', borderRadius: 12, padding: 16 }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>
                  Simulated workspace views · no role permissions
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className={`secondary ${isPassenger ? 'active' : ''}`}
                    style={{
                      border: isPassenger ? '2px solid #285943' : undefined,
                      padding: 12,
                      textAlign: 'left',
                    }}
                    onClick={() => {
                      navigate('find');
                      setDialog(null);
                    }}
                  >
                    👤 Passenger
                  </button>
                  <button
                    type="button"
                    className={`secondary ${isDriver ? 'active' : ''}`}
                    style={{
                      border: isDriver ? '2px solid #285943' : undefined,
                      padding: 12,
                      textAlign: 'left',
                    }}
                    onClick={() => {
                      navigate('driver_groups');
                      setDialog(null);
                    }}
                  >
                    🚗 Driver
                  </button>
                  <button
                    type="button"
                    className={`secondary ${isSupport ? 'active' : ''}`}
                    style={{
                      border: isSupport ? '2px solid #1a73e8' : undefined,
                      padding: 12,
                      textAlign: 'left',
                    }}
                    onClick={() => {
                      navigate('support_dispatch');
                      setDialog(null);
                    }}
                  >
                    🎧 Customer Support
                  </button>
                  <button
                    type="button"
                    className={`secondary ${isAdmin ? 'active' : ''}`}
                    style={{
                      border: isAdmin ? '2px solid #92400e' : undefined,
                      padding: 12,
                      textAlign: 'left',
                    }}
                    onClick={() => {
                      navigate('admin_overview');
                      setDialog(null);
                    }}
                  >
                    🛡️ Administrator
                  </button>
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
      <button className="primary" onClick={() => onClick()}>
        {action}
        <Icon name="arrow" size={17} />
      </button>
    </div>
  );
}
