-- One vehicle departure, with private passenger reservations beneath it.
CREATE TABLE planned_departures (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES driver_access(id),
  trip_id TEXT NOT NULL,
  departure TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 8),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','boarding','in_progress','completed')),
  UNIQUE(driver_id, trip_id, departure)
);
ALTER TABLE dispatch_requests ADD COLUMN departure_id TEXT REFERENCES planned_departures(id);
INSERT INTO planned_departures(id, driver_id, trip_id, departure, capacity, status)
SELECT lower(hex(randomblob(16))), r.driver_id, json_extract(r.data,'$.tripId'),
  json_extract(r.data,'$.departure'), d.seats,
  CASE WHEN SUM(r.status='in_progress') > 0 THEN 'in_progress'
       WHEN SUM(r.status='accepted') > 0 THEN 'boarding'
       WHEN SUM(r.status='completed') > 0 THEN 'completed' ELSE 'open' END
FROM dispatch_requests r JOIN driver_access d ON d.id=r.driver_id
WHERE r.kind='planned'
GROUP BY r.driver_id, json_extract(r.data,'$.tripId'), json_extract(r.data,'$.departure');
UPDATE dispatch_requests SET departure_id=(SELECT p.id FROM planned_departures p
  WHERE p.driver_id=dispatch_requests.driver_id AND p.trip_id=json_extract(data,'$.tripId')
    AND p.departure=json_extract(data,'$.departure')) WHERE kind='planned';
CREATE INDEX dispatch_departure_status ON dispatch_requests(departure_id, status);

CREATE TABLE mutation_receipts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(workspace_id, key)
);
CREATE INDEX mutation_receipts_created ON mutation_receipts(created_at);
CREATE TABLE rate_limits (
  subject TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);

-- Integer minor units, simulated only. This is not a payment provider ledger.
CREATE TABLE preview_settlements (
  request_id TEXT PRIMARY KEY REFERENCES dispatch_requests(id),
  driver_id TEXT NOT NULL REFERENCES driver_access(id),
  departure_id TEXT REFERENCES planned_departures(id),
  gross_minor INTEGER NOT NULL CHECK(gross_minor >= 0),
  fee_minor INTEGER NOT NULL CHECK(fee_minor >= 0),
  payout_minor INTEGER NOT NULL CHECK(payout_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ETB' CHECK(currency='ETB'),
  simulated INTEGER NOT NULL DEFAULT 1 CHECK(simulated=1),
  created_at TEXT NOT NULL,
  CHECK(gross_minor=fee_minor+payout_minor)
);
INSERT INTO preview_settlements(request_id,driver_id,departure_id,gross_minor,fee_minor,payout_minor,created_at)
SELECT id,driver_id,departure_id,CAST(ROUND(json_extract(data,'$.fare')*100) AS INTEGER),
 CAST(ROUND(json_extract(data,'$.fare')*100) AS INTEGER)-CAST(ROUND(json_extract(data,'$.payout')*100) AS INTEGER),
 CAST(ROUND(json_extract(data,'$.payout')*100) AS INTEGER),updated_at
FROM dispatch_requests WHERE status='completed';
CREATE TRIGGER settlement_no_update BEFORE UPDATE ON preview_settlements BEGIN
 SELECT RAISE(ABORT, 'Preview settlements are append-only'); END;
CREATE TRIGGER settlement_no_delete BEFORE DELETE ON preview_settlements BEGIN
 SELECT RAISE(ABORT, 'Preview settlements are append-only'); END;
