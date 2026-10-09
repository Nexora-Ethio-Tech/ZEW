import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { day, time, type Journey, type Trip } from '@/lib/api';

export function DriverProfile({ trip, onChoose }: { trip: Trip; onChoose: () => void }) {
  return (
    <div className="planned-driver-profile">
      <div className="account-summary">
        <span className="avatar">{trip.driver[0]}</span>
        <div>
          <h3>{trip.driver}</h3>
          <p>{trip.vehicle}</p>
        </div>
      </div>
      <p className="modal-description">
        Preview driver listing. Identity, licence and vehicle verification are not available.
      </p>
      <div className="booking-summary">
        <p>
          <span>Available seats</span>
          <strong>{trip.availableSeats}</strong>
        </p>
        <p>
          <span>Departure</span>
          <strong>
            {day(trip.departure)} · {time(trip.departure)} EAT
          </strong>
        </p>
        <p>
          <span>Projected fare per seat</span>
          <strong>{trip.fare} ETB</strong>
        </p>
      </div>
      <p className="modal-description">
        Ratings, vehicle features and registration details will appear when verified information is
        available.
      </p>
      <button className="primary full" onClick={onChoose}>
        Review reservation
        <Icon name="arrow" size={17} />
      </button>
    </div>
  );
}

export function BookingConfirmation({
  trip,
  journey,
  stopName,
  busy,
  confirm,
  searchAgain,
}: {
  trip: Trip;
  journey: Journey;
  stopName: (id: string) => string;
  busy: boolean;
  confirm: () => void;
  searchAgain: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = !trip.quoteExpiresAt || Date.parse(trip.quoteExpiresAt) <= now;
  return (
    <div>
      <p className="modal-description">
        {stopName(journey.origin)} → {stopName(journey.destination)}
      </p>
      <div className="booking-summary">
        <p>
          <span>Assigned test driver</span>
          <strong>{trip.driver}</strong>
        </p>
        <p>
          <span>Departure</span>
          <strong>
            {day(trip.departure)} · {time(trip.departure)} EAT
          </strong>
        </p>
        <p>
          <span>Vehicle</span>
          <strong>{trip.vehicle}</strong>
        </p>
        <p>
          <span>Projected fare per seat</span>
          <strong>{trip.fare} ETB</strong>
        </p>
        <p>
          <span>Your reserved seats</span>
          <strong data-reserved-seats>
            {journey.seats} {journey.seats === 1 ? 'seat' : 'seats'}
          </strong>
        </p>
        <p className="total">
          <span>YOUR TOTAL</span>
          <strong data-reservation-total>{trip.totalFare} ETB</strong>
        </p>
      </div>
      <p className="modal-description">
        Confirm to request these seats. Your driver must accept before boarding. This is a preview
        reservation; no payment is collected.
      </p>
      <p className="modal-description" role={expired ? 'status' : undefined}>
        {expired
          ? 'This quote expired. Search again to review the current fare and seats.'
          : `Quote valid until ${time(trip.quoteExpiresAt!)} EAT. Seats are checked again when you confirm.`}
      </p>
      {expired && (
        <button className="secondary full" disabled={busy} onClick={searchAgain}>
          Refresh available rides
        </button>
      )}
      <button
        className="primary full"
        disabled={busy || trip.totalFare === undefined || !trip.quoteId || expired}
        onClick={confirm}
      >
        {busy ? 'Reserving…' : 'Confirm preview reservation'}
        <Icon name="check" size={17} />
      </button>
    </div>
  );
}
