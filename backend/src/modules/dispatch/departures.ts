import type { DatabaseSync } from 'node:sqlite';
import type { State } from '../trips/model.js';
import { ApiError } from '../../shared/http-error.js';
import type { AssignedRow } from './service.js';

// Every workspace and its dispatch projection changes in the caller's transaction.
export function coordinateDeparture(
  db: DatabaseSync,
  departureId: string,
  action: 'start' | 'complete',
  read: (workspaceId: string) => State,
  save: (workspaceId: string, state: State, kind: string, entityId: string) => void,
  required = false,
) {
  const rows = db
    .prepare(
      "SELECT * FROM dispatch_requests WHERE departure_id=? AND status IN ('requested','accepted','in_progress')",
    )
    .all(departureId) as unknown as AssignedRow[];
  if (action === 'start') {
    const ready =
      rows.length > 0 &&
      rows.every(
        (row) =>
          row.status === 'accepted' &&
          read(row.workspace_id).bookings.find((booking) => booking.id === row.id)
            ?.boardingVerified,
      );
    if (!ready) {
      if (required)
        throw new ApiError(
          409,
          'Accept or decline all requests and confirm each passenger’s boarding code first.',
        );
      return false;
    }
  }
  for (const row of rows) {
    if (action === 'complete' && row.status !== 'in_progress')
      throw new ApiError(
        409,
        'This departure contains an unresolved reservation. Contact the operator.',
      );
    const state = read(row.workspace_id);
    const booking = state.bookings.find((item) => item.id === row.id);
    if (!booking) throw new ApiError(409, 'Reservation needs operator review.');
    booking.status = action === 'start' ? 'in_progress' : 'completed';
    if (action === 'complete') booking.payment = 'simulated';
    save(row.workspace_id, state, 'departure.' + action, row.id);
  }
  db.prepare('UPDATE planned_departures SET status=? WHERE id=?').run(
    action === 'start' ? 'in_progress' : 'completed',
    departureId,
  );
  return true;
}
