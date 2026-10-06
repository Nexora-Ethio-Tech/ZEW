import { Icon } from '@/components/icon';
import { Avatar } from './avatar';
import { money, type Pool } from './types';

export function FarePanel({
  pool,
  busy,
  now,
  action,
  driverView,
  explain,
  onTelebirrPay,
}: {
  pool: Pool;
  busy: boolean;
  now: number;
  action: (path: string, body?: unknown) => Promise<boolean>;
  driverView: () => void;
  explain: () => void;
  onTelebirrPay?: () => void;
}) {
  const draft = pool.status === 'draft';
  const members = pool.riders.filter((r) => pool.selectedIds.includes(r.id));
  const expiredMember = members.some((r) => r.readyUntil <= now);
  const locationStale =
    pool.locationSource === 'device' && !!pool.location && now - pool.location.timestamp > 120000;
  const waitingExpired =
    ['requested', 'accepted'].includes(pool.status) &&
    ((pool.requestedUntil ?? 0) <= now || expiredMember || locationStale);
  const status = waitingExpired ? 'expired' : pool.status;
  const finished = ['completed', 'cancelled', 'expired'].includes(status);
  const driver = pool.drivers.find((d) => d.id === pool.driverId);
  return (
    <aside className="fare-column">
      <section className="group-card" aria-label="Your circle and fare">
        <div className="group-card-heading">
          <span className="group-heading-icon">
            <Icon name="people" size={21} />
          </span>
          <h2>Your ride circle</h2>
          <span>{pool.quote.count}/4</span>
        </div>
        <p className="group-subtitle">A few good neighbours. One shared way.</p>
        <div className="group-seats">
          <div>
            <Avatar name="You" color="green" size={48} />
            <span>You</span>
          </div>
          {members.map((r) => (
            <div key={r.id} className="occupied-seat">
              <Avatar name={r.name} color={r.color} size={48} />
              {draft && (
                <button
                  disabled={busy}
                  aria-label={`Remove ${r.name}`}
                  onClick={() => void action('/members', { riderId: r.id, action: 'remove' })}
                >
                  <Icon name="close" size={10} />
                </button>
              )}
              <span>{r.name.split(' ')[0]}</span>
            </div>
          ))}
          {Array.from({ length: 4 - pool.quote.count }, (_, i) => (
            <div key={i}>
              <span className="empty-seat">
                <Icon name="plus" size={19} />
              </span>
              <span>Open seat</span>
            </div>
          ))}
        </div>
        <div className="fare-divider" />
        <p className="fare-eyebrow">YOUR DEMO SHARE</p>
        {pool.destination === 'custom' && (
          <p className="custom-fare-note">360 ETB example total. Not a road-distance quote.</p>
        )}
        <div className="group-fare" aria-live="polite">
          <strong key={pool.quote.yourFare}>{money(pool.lockedFare ?? pool.quote.yourFare)}</strong>
          <span>
            ETB <small>/ person</small>
          </span>
        </div>
        <div className="fare-saving">
          {pool.quote.count > 1 ? (
            <>
              <span className="saving-tag">
                <Icon name="leaf" size={13} /> Save {money(pool.quote.savings)} ETB
              </span>
              <s>{money(pool.quote.total)} ETB alone</s>
            </>
          ) : (
            <span className="solo-hint">
              With 3 people, your example share is {money(pool.fareOptions[2].yourFare)} ETB.
            </span>
          )}
        </div>
        <div className="split-line">
          <span>Example trip total</span>
          <strong>{pool.quote.total} ETB</strong>
        </div>
        <div className="split-line">
          <span>Split between</span>
          <strong>
            {pool.quote.count} {pool.quote.count === 1 ? 'person' : 'people'}
          </strong>
        </div>
        <button className="fare-explain" onClick={explain}>
          How is my fare calculated?
          <Icon name="help" size={13} />
        </button>
        {draft ? (
          <>
            <div className="auto-group-box">
              <div className="auto-group-header">
                <strong>⚡ Auto-Group Match</strong>
                <span className="auto-group-tag">RECOMMENDED</span>
              </div>
              <p className="auto-group-desc">System assigns compatible neighbours along your corridor</p>
              <div className="auto-group-buttons">
                {[2, 3, 4].map((seats) => (
                  <button
                    key={seats}
                    type="button"
                    className={`auto-group-btn ${pool.quote.count === seats ? 'selected' : ''}`}
                    disabled={busy}
                    onClick={() => void action('/auto-match', { targetSeats: seats })}
                  >
                    {seats === 2 ? 'Pair (2)' : seats === 3 ? 'Trio (3)' : 'Full (4)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="fare-progress">
              <div style={{ width: `${pool.quote.count * 25}%` }} />
            </div>
            <div className="fare-stages">
              <span>Just you</span>
              <span>Better together</span>
            </div>
            {(expiredMember || locationStale || pool.requestIssue) && (
              <p className="group-inline-warning">
                {pool.requestIssue ||
                  (locationStale
                    ? 'Refresh your device location to continue.'
                    : 'A rider’s availability expired. Refresh nearby riders.')}
              </p>
            )}
            <button
              className="pool-primary request-group"
              disabled={busy || expiredMember || locationStale || !!pool.requestIssue}
              onClick={() => void action('/request', { version: pool.version })}
            >
              {busy
                ? 'Updating…'
                : pool.quote.count > 1
                  ? 'Request this group'
                  : 'Request solo ride'}
              <Icon name="arrow" size={18} />
            </button>
            <p className="request-note">Review your group, then request. No payment required.</p>
          </>
        ) : (
          <div className={`group-status-panel ${status}`} role="status">
            <span className="status-symbol">
              <Icon
                name={
                  status === 'completed'
                    ? 'check'
                    : status === 'expired' || status === 'cancelled'
                      ? 'clock'
                      : 'car'
                }
                size={22}
              />
            </span>
            <h3>
              {status === 'requested'
                ? 'Your group is ready to go.'
                : status === 'accepted'
                  ? `${driver?.name} accepted your group!`
                  : status === 'in_progress'
                    ? 'Enjoy the shared journey.'
                    : status === 'completed'
                      ? 'A better ride, together.'
                      : status === 'expired'
                        ? 'This request has expired.'
                        : 'Your request was cancelled.'}
            </h3>
            <p>
              {status === 'requested'
                ? `Waiting for a demo driver · ${Math.max(0, Math.ceil(((pool.requestedUntil ?? 0) - now) / 1000))}s left`
                : status === 'accepted'
                  ? `${driver?.car} · ${driver?.plate}`
                  : status === 'in_progress'
                    ? 'Your fare is locked. No additional riders will be added.'
                    : status === 'completed'
                      ? 'Demo trip completed. No money was charged.'
                      : 'Start a fresh group with people who are ready now.'}
            </p>
            {pool.guidance && (
              <div className="gathering-guidance-box">
                <div className="guidance-title">
                  <Icon name="pin" size={15} />
                  <strong>Gathering Guidance</strong>
                </div>
                <p className="meeting-point">{pool.guidance.meetingPoint}</p>
                <p className="guidance-instruction">{pool.guidance.instruction}</p>
                {pool.guidance.crossStreet && (
                  <span className="cross-street-warning">
                    ⚠️ Zebra crossing required (30m ahead)
                  </span>
                )}
              </div>
            )}
            {status === 'requested' && (
              <button className="pool-primary" disabled={busy} onClick={driverView}>
                Try the driver view
                <Icon name="arrow" size={16} />
              </button>
            )}
            {status === 'accepted' && (
              <>
                <button
                  className="pool-primary"
                  disabled={busy}
                  onClick={() => void action('/action', { action: 'start' })}
                >
                  Start demo ride
                  <Icon name="arrow" size={16} />
                </button>
                {onTelebirrPay && (
                  <button
                    type="button"
                    className="telebirr-pay-btn mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-cyan-500 hover:to-blue-500 transition flex items-center justify-center gap-2"
                    onClick={onTelebirrPay}
                  >
                    <span>tb</span> Pay Share with Telebirr (USSD)
                  </button>
                )}
              </>
            )}
            {status === 'in_progress' && (
              <>
                <button
                  className="pool-primary"
                  disabled={busy}
                  onClick={() => void action('/action', { action: 'complete' })}
                >
                  Complete demo ride
                  <Icon name="check" size={16} />
                </button>
                {onTelebirrPay && (
                  <button
                    type="button"
                    className="telebirr-pay-btn mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-cyan-500 hover:to-blue-500 transition flex items-center justify-center gap-2"
                    onClick={onTelebirrPay}
                  >
                    <span>tb</span> Pay Share with Telebirr (USSD)
                  </button>
                )}
              </>
            )}
            {finished && (
              <>
                {onTelebirrPay && (
                  <button
                    type="button"
                    className="telebirr-pay-btn mb-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-cyan-500 hover:to-blue-500 transition flex items-center justify-center gap-2"
                    onClick={onTelebirrPay}
                  >
                    <span>tb</span> Pay Share with Telebirr (USSD)
                  </button>
                )}
                <button
                  className="pool-primary"
                  disabled={busy}
                  onClick={() => void action('/action', { action: 'new' })}
                >
                  Build another group
                  <Icon name="plus" size={16} />
                </button>
              </>
            )}
            {!finished && status !== 'in_progress' && (
              <button
                className="group-cancel"
                disabled={busy}
                onClick={() => void action('/action', { action: 'cancel' })}
              >
                Cancel request
              </button>
            )}
          </div>
        )}
        <span className="group-demo-note">Demo pricing · No payment required</span>
      </section>
      <section className="two-minute-card">
        <span className="two-minute-icon">
          <Icon name="clock" size={23} />
          <b>2</b>
        </span>
        <div>
          <h3>Close by. Ready to go.</h3>
          <p>Try a shared ride with a two-minute demo pickup window.</p>
          <span>Fictional timings · real possibilities.</span>
        </div>
      </section>
      <section className="pool-together-note">
        <div className="mini-avatars">
          <Avatar name="Sample rider" color="peach" size={26} />
          <Avatar name="Sample rider" color="blue" size={26} />
          <Avatar name="Sample rider" color="lavender" size={26} />
        </div>
        <p>
          Small circles.
          <br />
          <strong>A little less traffic for Addis.</strong>
        </p>
      </section>
    </aside>
  );
}
