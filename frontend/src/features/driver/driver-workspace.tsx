'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, day, time } from '@/lib/api';
import { restoreAccount, signOut, type Account } from '@/lib/auth';
import { Icon } from '@/components/icon';
import { AuthModal } from '@/features/auth/auth-modal';
import './driver.css';

interface Request {
  id: string;
  kind: 'circle' | 'planned';
  status: string;
  riderName: string;
  pickup: string;
  destination: string;
  seats: number;
  fare: number;
  payout: number;
  requestedUntil?: number;
  departure?: string;
  departureId?: string;
  boardingVerified?: boolean;
  preview: true;
}
interface Dashboard {
  driver: { name: string; vehicle: string; seats: number };
  requests: Request[];
  earnings: { completed: number; payout: number; simulated: true };
}
type Tab = 'requests' | 'active' | 'history' | 'earnings';
const labels: Record<Tab, string> = {
  requests: 'Requests',
  active: 'Active ride',
  history: 'Ride history',
  earnings: 'Earnings',
};
const money = (value: number) => value.toLocaleString('en-ET', { maximumFractionDigits: 2 });

export function DriverWorkspace() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [login, setLogin] = useState(false);
  const [data, setData] = useState<Dashboard>();
  const [tab, setTab] = useState<Tab>('requests');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    restoreAccount()
      .then((user) => {
        if (live) setAccount(user);
      })
      .catch(() => {
        if (live) setError('Could not restore your account. Please sign in again.');
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const readSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    const dashboard = await api<Dashboard>('/driver/dashboard');
    if (sequence === readSequence.current) setData(dashboard);
  }, []);
  useEffect(() => {
    if (account?.role !== 'driver') return;
    const load = () => refresh().catch((e) => setError(e.message));
    void load();
    const poll = setInterval(() => {
      if (!document.hidden && navigator.onLine) void load();
    }, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener('online', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener('online', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [account, refresh]);
  async function action(request: Request, action: string) {
    if (busy) return;
    setBusy(request.id);
    setError('');
    try {
      await api('/driver/requests/' + request.id + '/action', 'POST', {
        action,
        ...(action === 'start' ? { code: codes[request.id] ?? '' } : {}),
      });
      setCodes({});
      if (action === 'accept' || action === 'start') setTab('active');
      if (action === 'complete') setTab('history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this ride.');
    } finally {
      await refresh().catch(() => setError('Connection lost. Refresh to check the ride status.'));
      setBusy('');
    }
  }
  async function startDeparture(id: string) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await api('/driver/departures/' + id + '/start', 'POST', {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start this departure.');
    } finally {
      await refresh().catch(() => setError('Refresh to check the departure status.'));
      setBusy('');
    }
  }
  async function logout() {
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    }
  }
  if (checking)
    return (
      <main className="driver-gate" role="status">
        Opening your driver workspace…
      </main>
    );
  if (account?.role !== 'driver')
    return (
      <main className="driver-gate">
        <Link href="/" className="driver-brand">
          zew ↗
        </Link>
        <h1>Your driver workspace.</h1>
        <p>
          {account
            ? 'This account has passenger access. Sign in with your approved driver account.'
            : 'Sign in with your confirmed driver email to see your assigned rides.'}
        </p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => setLogin(true)}>Driver sign in</button>
        {account && <Link href="/planned">Open passenger workspace</Link>}
        <AuthModal isOpen={login} onClose={() => setLogin(false)} onSuccess={setAccount} />
      </main>
    );
  const status = (r: Request) =>
    r.kind === 'circle' &&
    ['requested', 'accepted'].includes(r.status) &&
    (r.requestedUntil ?? Infinity) <= now
      ? 'expired'
      : r.status;
  const requests = data?.requests ?? [];
  const incoming = requests.filter((r) => status(r) === 'requested');
  const active = requests.filter((r) => ['accepted', 'in_progress'].includes(status(r)));
  const history = requests.filter((r) => ['completed', 'cancelled', 'expired'].includes(status(r)));
  const conflicts = (request: Request) =>
    active.some(
      (ride) =>
        ride.status === 'in_progress' ||
        !request.departureId ||
        ride.departureId !== request.departureId,
    );
  const shared = active.find((ride) => ride.departureId);
  const companions = shared
    ? requests.filter(
        (ride) =>
          ride.departureId === shared.departureId &&
          ['requested', 'accepted', 'in_progress'].includes(status(ride)),
      )
    : [];
  const waiting = companions.filter((ride) => ride.status === 'requested');
  const ready =
    companions.length > 0 &&
    companions.every((ride) => ride.status === 'accepted' && ride.boardingVerified);
  const shown = tab === 'requests' ? incoming : tab === 'active' ? active : history;
  return (
    <div className="driver-app">
      <aside className="driver-sidebar">
        <Link href="/driver" className="driver-brand" aria-label="Zew driver home">
          zew ↗
        </Link>
        <span className="driver-eyebrow">DRIVER WORKSPACE</span>
        <nav aria-label="Driver navigation">
          {(Object.keys(labels) as Tab[]).map((item) => (
            <button
              key={item}
              aria-current={tab === item ? 'page' : undefined}
              onClick={() => setTab(item)}
            >
              <Icon
                name={
                  item === 'earnings'
                    ? 'wallet'
                    : item === 'history'
                      ? 'rides'
                      : item === 'active'
                        ? 'car'
                        : 'people'
                }
                size={19}
              />
              {labels[item]}{' '}
              {item === 'requests' && incoming.length > 0 && <b>{incoming.length}</b>}
            </button>
          ))}
        </nav>
        <div className="driver-profile">
          <strong>{data?.driver.name ?? account.name}</strong>
          <span>
            {data?.driver.vehicle} · {data?.driver.seats ?? 4} seats
          </span>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="driver-main">
        <header>
          <div>
            <p className="driver-eyebrow">A BETTER RIDE, TOGETHER</p>
            <h1>{labels[tab]}</h1>
            <p>
              {tab === 'requests'
                ? 'Review the journeys assigned to you.'
                : tab === 'active'
                  ? 'Meet your passengers and confirm boarding.'
                  : tab === 'history'
                    ? 'Your completed and closed requests.'
                    : 'Your completed rides, accounted for.'}
            </p>
          </div>
          <span className="driver-preview">Test rides · Simulated payments</span>
        </header>
        {error && (
          <div className="driver-error" role="alert">
            {error}
            <button
              onClick={() => {
                setError('');
                void refresh().catch((e) => setError(e.message));
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!data ? (
          <p role="status">Loading your requests…</p>
        ) : tab === 'earnings' ? (
          <section className="driver-earnings">
            <p>PROJECTED PAYOUT</p>
            <h2>
              {money(data.earnings.payout)} <small>ETB</small>
            </h2>
            <p>{data.earnings.completed} completed rides</p>
            <small>No funds have been collected or transferred.</small>
          </section>
        ) : (
          <>
            {tab === 'active' && shared && (
              <section className="driver-request driver-departure" aria-label="Shared departure">
                <p className="driver-eyebrow">SHARED DEPARTURE</p>
                <h2>
                  {day(shared.departure!)} · {time(shared.departure!)} EAT
                </h2>
                <p>
                  {companions.length} reservations ·{' '}
                  {companions.reduce((sum, ride) => sum + ride.seats, 0)} passenger seats
                </p>
                <p>
                  {shared.status === 'in_progress'
                    ? 'All passengers are on the way. Completing this ride updates every reservation.'
                    : 'Each passenger has a separate boarding code. The trip starts together after all codes are confirmed.'}
                </p>
                <div className="driver-actions">
                  {waiting.length > 0 && (
                    <button className="secondary" onClick={() => setTab('requests')}>
                      Review {waiting.length} remaining{' '}
                      {waiting.length === 1 ? 'request' : 'requests'}
                    </button>
                  )}
                  {ready && (
                    <button
                      disabled={!!busy}
                      onClick={() => void startDeparture(shared.departureId!)}
                    >
                      Start shared ride
                    </button>
                  )}
                  {shared.status === 'in_progress' && (
                    <button disabled={!!busy} onClick={() => void action(shared, 'complete')}>
                      Complete shared ride
                    </button>
                  )}
                </div>
              </section>
            )}
            {shown.length === 0 && (
              <section className="driver-empty">
                <Icon name={tab === 'active' ? 'car' : 'rides'} size={36} />
                <h2>
                  {tab === 'requests'
                    ? 'Ready for your next request.'
                    : tab === 'active'
                      ? 'No active ride.'
                      : 'Your journeys will appear here.'}
                </h2>
                <p>
                  {tab === 'requests'
                    ? 'New requests appear automatically.'
                    : tab === 'active'
                      ? 'Accept a request to begin.'
                      : 'Completed, declined and expired requests are saved here.'}
                </p>
              </section>
            )}
            <div className="driver-request-list">
              {shown.map((request) => (
                <article key={request.id} className="driver-request">
                  <div className="driver-request-top">
                    <span>{request.kind === 'circle' ? 'RIDE CIRCLE' : 'PLANNED RIDE'}</span>
                    <strong>{status(request).replace('_', ' ')}</strong>
                  </div>
                  <h2>
                    {request.pickup}
                    <span aria-hidden="true"> → </span>
                    {request.destination}
                  </h2>
                  <p>
                    {request.riderName} · {request.seats} passenger{' '}
                    {request.seats === 1 ? 'seat' : 'seats'}
                  </p>
                  {request.departure && (
                    <p>
                      {day(request.departure)} · {time(request.departure)} EAT
                    </p>
                  )}
                  {request.requestedUntil &&
                    ['requested', 'accepted'].includes(status(request)) && (
                      <p className="driver-window">
                        {Math.max(0, Math.ceil((request.requestedUntil - now) / 1000))}s in pickup
                        window
                      </p>
                    )}
                  <div className="driver-fares">
                    <span>
                      Trip total <b>{money(request.fare)} ETB</b>
                    </span>
                    <span>
                      Your projected share <b>{money(request.payout)} ETB</b>
                    </span>
                  </div>
                  {status(request) === 'requested' && (
                    <div className="driver-actions">
                      <button
                        disabled={!!busy || conflicts(request)}
                        onClick={() => void action(request, 'accept')}
                      >
                        Accept request
                      </button>
                      <button
                        className="secondary"
                        disabled={!!busy}
                        onClick={() => void action(request, 'decline')}
                      >
                        Decline
                      </button>
                      {conflicts(request) && (
                        <small>Finish your active ride to accept another.</small>
                      )}
                    </div>
                  )}
                  {status(request) === 'accepted' && request.boardingVerified && (
                    <p role="status">Boarding confirmed. Waiting for the other passengers.</p>
                  )}
                  {status(request) === 'accepted' && !request.boardingVerified && (
                    <form
                      className="driver-actions"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void action(request, 'start');
                      }}
                    >
                      <label htmlFor={'code-' + request.id}>
                        Passenger boarding code
                        <input
                          id={'code-' + request.id}
                          required
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          autoComplete="off"
                          value={codes[request.id] ?? ''}
                          onChange={(e) => setCodes({ ...codes, [request.id]: e.target.value })}
                          placeholder="4-digit code"
                        />
                      </label>
                      <button disabled={!!busy}>
                        {request.kind === 'planned'
                          ? 'Confirm passenger boarding'
                          : 'Confirm boarding & start'}
                      </button>
                    </form>
                  )}
                  {status(request) === 'in_progress' && !request.departureId && (
                    <div className="driver-actions">
                      <button disabled={!!busy} onClick={() => void action(request, 'complete')}>
                        Complete ride
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
