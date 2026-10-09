import { useId, useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { localDeparture, type Corridor, type Journey } from '@/lib/api';

type Stop = Corridor['stops'][number];
// Keep the component identity stable: dashboard polling must not remount a focused input.
function StopField({
  label,
  value,
  stops,
  onChange,
}: {
  label: string;
  value: string;
  stops: Stop[];
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const selected = stops.find((stop) => stop.id === value);
  const matches = stops.filter((stop) =>
    `${stop.name} ${stop.area}`.toLowerCase().includes(query.toLowerCase()),
  );
  function choose(stop: Stop) {
    onChange(stop.id);
    setFocused(false);
    setQuery('');
  }
  return (
    <div className="location-field" style={{ position: 'relative' }}>
      <span className={`location-marker ${label.toLowerCase()}`} />
      <label style={{ width: '100%' }}>
        <small>{label.toUpperCase()}</small>
        <input
          role="combobox"
          aria-expanded={focused}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={focused && matches[active] ? `${id}-${active}` : undefined}
          placeholder="Search places..."
          value={focused ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setFocused(true);
          }}
          onFocus={() => {
            setQuery('');
            setActive(0);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setFocused(false);
              return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setFocused(true);
              setActive((index) =>
                Math.max(0, Math.min(matches.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))),
              );
            }
            if (e.key === 'Enter' && focused && matches[active]) {
              e.preventDefault();
              choose(matches[active]);
            }
          }}
        />
      </label>
      {focused && (
        <div
          id={id}
          role="listbox"
          aria-label={`${label} places`}
          className="planned-place-results"
        >
          {matches.map((stop, index) => (
            <button
              id={`${id}-${index}`}
              key={stop.id}
              type="button"
              role="option"
              aria-selected={index === active}
              className="place-result"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(stop)}
            >
              <strong>{stop.name}</strong>
              <small>{stop.area}</small>
            </button>
          ))}
          {!matches.length && <p role="status">No places found.</p>}
        </div>
      )}
    </div>
  );
}

export function JourneyFields({
  journey,
  corridors,
  update,
  departureLabel,
}: {
  journey: Journey;
  corridors: Corridor[];
  update: (changes: Partial<Journey>) => void;
  departureLabel: string;
}) {
  const stops = useMemo(
    () => [...new Map(corridors.flatMap((c) => c.stops).map((s) => [s.id, s])).values()],
    [corridors],
  );
  function route(origin: string, destination: string) {
    const corridor = corridors.find(
      (c) => c.stops.some((s) => s.id === origin) && c.stops.some((s) => s.id === destination),
    );
    update({ origin, destination, corridorId: corridor?.id ?? journey.corridorId });
  }
  return (
    <>
      <div className="route-inputs">
        <StopField
          label="Pickup"
          value={journey.origin}
          stops={stops}
          onChange={(origin) => route(origin, journey.destination)}
        />
        <button
          type="button"
          className="swap-button"
          aria-label="Swap pickup and destination"
          onClick={() => route(journey.destination, journey.origin)}
        >
          <Icon name="swap" size={16} />
        </button>
        <StopField
          label="Drop-off"
          value={journey.destination}
          stops={stops}
          onChange={(destination) => route(journey.origin, destination)}
        />
      </div>
      <div className="planned-journey-options">
        <label className="field">
          {departureLabel}
          <input
            aria-label="Departure time"
            required
            type="datetime-local"
            value={journey.departure ? localDeparture(journey.departure) : ''}
            onChange={(e) =>
              update({ departure: e.target.value ? `${e.target.value}:00+03:00` : '' })
            }
          />
        </label>
        <label className="field">
          Seats to reserve
          <select
            aria-label="Seats to reserve"
            value={journey.seats}
            onChange={(e) => update({ seats: Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((seats) => (
              <option key={seats} value={seats}>
                {seats} {seats === 1 ? 'seat' : 'seats'}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
