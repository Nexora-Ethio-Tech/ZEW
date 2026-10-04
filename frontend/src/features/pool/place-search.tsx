'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Place } from './types';

export function PlaceSearch({
  target,
  value,
  disabled,
  choose,
}: {
  target: 'pickup' | 'destination';
  value: string;
  disabled: boolean;
  choose: (place: Place) => Promise<boolean>;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setQuery(value);
    setResults([]);
    setStatus('');
  }, [value]);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const request = ++revision.current;
    setSearching(true);
    setStatus('');
    setResults([]);
    try {
      const data = await api<{ places: Place[] }>('/places/search', 'POST', { query });
      if (request !== revision.current) return;
      setResults(data.places);
      setStatus(
        data.places.length
          ? 'Choose a result to confirm this place.'
          : 'No places found. Add a city or choose a pin on the map.',
      );
    } catch (error) {
      if (request === revision.current)
        setStatus(error instanceof Error ? error.message : 'Search unavailable.');
    } finally {
      setSearching(false);
    }
  }
  return (
    <div className="place-search">
      <form onSubmit={search}>
        <label htmlFor={`place-${target}`}>
          {target === 'pickup' ? 'YOUR PICKUP' : 'WHERE TO?'}
        </label>
        <div className="place-search-input">
          <input
            id={`place-${target}`}
            value={query}
            disabled={disabled}
            placeholder={
              target === 'pickup' ? 'Street, landmark, or place' : 'Where are you going?'
            }
            autoComplete="off"
            maxLength={150}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                revision.current++;
                setQuery(value);
                setStatus('');
                setResults([]);
              }
            }}
            onChange={(event) => {
              revision.current++;
              setQuery(event.target.value);
              setResults([]);
              setStatus('Press Search, then select a result to confirm.');
            }}
          />
          <button
            type="submit"
            aria-label={`Search ${target}`}
            disabled={disabled || searching || query.trim().length < 2}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      {status && (
        <div className="place-results">
          <p role="status">{status}</p>
          {results.map((place, i) => (
            <button
              type="button"
              key={`${place.latitude}-${place.longitude}-${i}`}
              disabled={disabled}
              onClick={async () => {
                if (await choose(place)) {
                  setQuery(place.name);
                  setResults([]);
                  setStatus('');
                }
              }}
            >
              <span>↗</span>
              <span>{place.name}</span>
            </button>
          ))}
          <button
            className="close-place-results"
            onClick={() => {
              revision.current++;
              setQuery(value);
              setStatus('');
              setResults([]);
            }}
          >
            Close results
          </button>
        </div>
      )}
    </div>
  );
}
