import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { Avatar } from './avatar';
import { money, type Pool } from './types';

export function FarePanel({
  pool,
  busy,
  now,
  action,
  explain,
  onPaymentInfo,
}: {
  pool: Pool;
  busy: boolean;
  now: number;
  action: (path: string, body?: unknown) => Promise<boolean>;
  explain: () => void;
  onPaymentInfo?: () => void;
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
  const driver = pool.assignedDriver
    ? { name: pool.assignedDriver.name, car: pool.assignedDriver.vehicle, plate: '' }
    : pool.drivers.find((d) => d.id === pool.driverId);
  const [minimumInput, setMinimumInput] = useState(String(pool.minSeats ?? 1));
  const [maximumInput, setMaximumInput] = useState(String(pool.maxSeats ?? 4));
  const [fareInput, setFareInput] = useState(String(pool.maxFare ?? pool.quote.total));
  useEffect(() => {
    setMinimumInput(String(pool.minSeats ?? 1));
    setMaximumInput(String(pool.maxSeats ?? 4));
    setFareInput(String(pool.maxFare ?? pool.quote.total));
  }, [pool.id, pool.minSeats, pool.maxSeats, pool.maxFare, pool.quote.total]);
  const minSeats = Number(minimumInput);
  const maxSeats = Number(maximumInput);
  const maxFare = Number(fareInput);
  const validLimits =
    minimumInput.trim() !== '' &&
    maximumInput.trim() !== '' &&
    fareInput.trim() !== '' &&
    Number.isSafeInteger(minSeats) &&
    minSeats > 0 &&
    Number.isSafeInteger(maxSeats) &&
    maxSeats >= minSeats &&
    Number.isFinite(maxFare) &&
    maxFare > 0;
  const pricedOptions = pool.fareOptions.filter(
    (option) => option.seats >= minSeats && option.seats <= maxSeats,
  );
  const affordableOptions = (validLimits ? pricedOptions : []).filter(
    (option) => option.yourFare <= maxFare && !option.issue,
  );
  const withinBudget = validLimits && affordableOptions.length > 0;
  const lowestShare = affordableOptions.length
    ? Math.min(...affordableOptions.map((option) => option.yourFare))
    : null;
  const highestShare = affordableOptions.length
    ? Math.max(...affordableOptions.map((option) => option.yourFare))
    : null;
  return (
    <aside className="fare-column">
      <section className="group-card" aria-label="Your circle and fare">
        <div className="group-card-heading">
          <span className="group-heading-icon">
            <Icon name="people" size={21} />
          </span>
          <h2>Your ride circle</h2>
          {!draft && <span>{pool.quote.count}/4</span>}
        </div>
        {!draft && (
          <>
            <div className="group-seats">
              <div>
                <Avatar name="You" color="green" size={48} />
                <span>You</span>
              </div>
              {members.map((r) => (
                <div key={r.id} className="occupied-seat">
                  <Avatar name={r.name} color={r.color} size={48} />
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
            <p className="fare-eyebrow">YOUR GROUP SHARE</p>
            {pool.destination === 'custom' && (
              <p className="custom-fare-note">
                {pool.quote.total} ETB projected total. Road pricing is unavailable.
              </p>
            )}
            <div className="group-fare" aria-live="polite">
              <strong>{money(pool.lockedFare ?? pool.quote.yourFare)}</strong>
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
                  With 3 people, your projected share is {money(pool.fareOptions[2].yourFare)} ETB.
                </span>
              )}
            </div>
            <div className="split-line">
              <span>Projected trip total</span>
              <strong>{pool.quote.total} ETB</strong>
            </div>
            <div className="split-line">
              <span>Split between</span>
              <strong>
                {pool.quote.count} {pool.quote.count === 1 ? 'person' : 'people'}
              </strong>
            </div>
          </>
        )}
        <button className="fare-explain" onClick={explain}>
          How is my fare calculated?
          <Icon name="help" size={13} />
        </button>
        {draft ? (
          <>
            <div className="auto-group-box">
              <div className="auto-group-header">
                <strong>System matching</strong>
                <span className="auto-group-tag">SIMULATED</span>
              </div>
              <p className="auto-group-desc">
                Choose how many people you are comfortable sharing with and your maximum fare.
                Eligible applications are grouped when you apply.
              </p>
              <div className="auto-group-controls">
                <div className="control-group">
                  <label htmlFor="minimum-people">Minimum people, including you</label>
                  <input
                    id="minimum-people"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={minimumInput}
                    disabled={busy}
                    onChange={(event) => setMinimumInput(event.target.value)}
                  />
                </div>
                <div className="control-group">
                  <label htmlFor="maximum-people">Maximum people, including you</label>
                  <input
                    id="maximum-people"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={maximumInput}
                    disabled={busy}
                    onChange={(event) => setMaximumInput(event.target.value)}
                  />
                </div>
              </div>
              <div className="criteria-price-list" aria-label="Fare breakdown by group size">
                {pricedOptions.map((option) => (
                  <div key={option.seats}>
                    <span>
                      {option.seats} {option.seats === 1 ? 'person' : 'people'}
                    </span>
                    <strong>
                      {money(option.yourFare)} ETB / you{option.issue ? ' · unavailable' : ''}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="control-group budget-group">
                <label htmlFor="maximum-fare">Maximum fare you would pay (ETB)</label>
                <input
                  id="maximum-fare"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={fareInput}
                  disabled={busy}
                  onChange={(event) => setFareInput(event.target.value)}
                />
              </div>
              <p className="criteria-price-note">
                {withinBudget
                  ? `Possible share: ${money(lowestShare!)}${lowestShare === highestShare ? '' : `–${money(highestShare!)}`} ETB. Final fare depends on the matched group.`
                  : !validLimits
                    ? 'Enter a valid minimum, maximum, and fare limit.'
                    : minSeats > pool.fareOptions.length
                      ? 'Configured vehicles have fewer seats than your minimum.'
                      : 'No currently available group fits these limits.'}
              </p>
              <p className="criteria-price-note">
                Configured vehicle capacity: up to {pool.fareOptions.length} passenger seats.
              </p>
            </div>
            {!withinBudget && (
              <p className="group-inline-warning">Adjust your group size or fare limit to apply.</p>
            )}
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
              disabled={
                busy || expiredMember || locationStale || !!pool.requestIssue || !withinBudget
              }
              onClick={() =>
                void action('/apply', { version: pool.version, minSeats, maxSeats, maxFare })
              }
            >
              {busy ? 'Matching…' : 'Apply for a shared ride'}
              <Icon name="arrow" size={18} />
            </button>
            <p className="request-note">Preview records only. No live ride or payment.</p>
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
                ? `Assigned to ${driver?.name ?? 'a staged driver'} · waiting for a preview response · ${Math.max(0, Math.ceil(((pool.requestedUntil ?? 0) - now) / 1000))}s left`
                : status === 'accepted'
                  ? `${driver?.car ?? 'Your assigned vehicle'}${driver?.plate ? ` · ${driver.plate}` : ''}`
                  : status === 'in_progress'
                    ? 'Your fare is locked. No additional riders will be added.'
                    : status === 'completed'
                      ? 'Journey completed in preview. No money was charged.'
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
                    Cross-street pickup: confirm a safe, legal crossing locally.
                  </span>
                )}
              </div>
            )}
            {status === 'accepted' && (
              <>
                {pool.boardingCode && (
                  <div className="boarding-code">
                    <small>YOUR BOARDING CODE</small>
                    <strong>{pool.boardingCode}</strong>
                    <span>Share this code with your driver when you board.</span>
                  </div>
                )}
              </>
            )}

            {finished && (
              <>
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
        {!draft && onPaymentInfo && (
          <button type="button" className="fare-explain" onClick={onPaymentInfo}>
            Payment preview information
            <Icon name="help" size={13} />
          </button>
        )}
        <span className="group-demo-note">Projected pricing · No payment required</span>
      </section>
      <section className="two-minute-card">
        <span className="two-minute-icon">
          <Icon name="clock" size={23} />
          <b>2</b>
        </span>
        <div>
          <h3>Close by. Ready to go.</h3>
          <p>Matching uses a two-minute pickup window.</p>
          <span>Road times have not been verified.</span>
        </div>
      </section>
      <section className="pool-together-note">
        <div className="mini-avatars">
          <Avatar name="Rider" color="peach" size={26} />
          <Avatar name="Rider" color="blue" size={26} />
          <Avatar name="Rider" color="lavender" size={26} />
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
