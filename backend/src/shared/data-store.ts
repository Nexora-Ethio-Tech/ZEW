import type { State, Trip, Journey, Booking } from '../modules/trips/model.js';
import type { DriverProfile, DispatchRequest } from '../modules/dispatch/model.js';
import type { AssignedRow } from '../modules/dispatch/service.js';
type Result<T> = T | Promise<T>;
export interface QuoteSnapshot {
  journey: Journey;
  trip: Trip;
  driverId: string;
  bookingId: string | null;
}
export interface DataStore {
  initialize?(): Promise<void>;
  create(): Result<{ token: string }>;
  createSessionForUser(identity: {
    id: string;
    email: string;
    name: string;
  }): Result<{ token: string; user: NonNullable<State['user']> }>;
  session(token: string): Result<string | undefined>;
  read(sessionId: string): Result<State>;
  mutate<T>(
    sessionId: string,
    kind: string,
    change: (state: State) => { value: T; entityId: string },
  ): Result<T>;
  reserveQuoted(
    sessionId: string,
    quoteId: string,
    change: (state: State, quote: QuoteSnapshot) => { value: Booking; entityId: string },
  ): Result<Booking>;
  driver(sessionId: string): Result<DriverProfile>;
  dispatchDriver(): Result<DriverProfile | undefined>;
  listAssigned(sessionId: string): Result<DispatchRequest[]>;
  mutateAssigned<T>(
    sessionId: string,
    requestId: string,
    action: string,
    change: (state: State, request: AssignedRow) => T,
  ): Result<T>;
  performDriverAction(
    sessionId: string,
    requestId: string,
    action: string,
    code?: string,
  ): Result<{ ok: boolean }>;
  startDeparture(sessionId: string, departureId: string): Result<{ ok: boolean }>;
  earnings(sessionId: string): Result<{ completed: number; payout: number; simulated: boolean }>;
  limitActor(sessionId: string): Result<void>;
  limitRequests(identity: string): Result<void>;
  events(sessionId: string): Result<unknown[]>;
  issueQuote(
    sessionId: string,
    journey: Journey,
    trip: Trip,
  ): Result<{ quoteId: string; quoteExpiresAt: string }>;
  availableSeats(trip: Trip): Result<number>;
  revoke(token: string): Result<void>;
  metric(route: string, status: number, elapsed: number): Result<void>;
  ready(): Result<boolean>;
  close(): Result<void>;
}
