-- Migration 002: Seed Demo Data
-- Populate initial corridors, sample drivers, and routes for Addis Ababa

INSERT OR IGNORE INTO corridors (id, name, stops) VALUES
  ('bole-centre', 'Bole → City centre', '[{"id":"bole","name":"Bole · Edna Mall","area":"Bole"},{"id":"atlas","name":"Atlas","area":"Bole"},{"id":"wollosefer","name":"Wollo Sefer","area":"Kirkos"},{"id":"meskel","name":"Meskel Square","area":"Kirkos"},{"id":"mexico","name":"Mexico","area":"Lideta"}]'),
  ('cmc-centre', 'CMC → City centre', '[{"id":"cmc","name":"CMC","area":"Yeka"},{"id":"megenagna","name":"Megenagna","area":"Yeka"},{"id":"hayahulet","name":"Haya Hulet","area":"Bole"},{"id":"kazanchis","name":"Kazanchis","area":"Kirkos"},{"id":"meskel","name":"Meskel Square","area":"Kirkos"}]');

INSERT OR IGNORE INTO trips (id, corridor_id, origin, destination, departure, seats, driver, vehicle, fare, source, status) VALUES
  ('sample-hana', 'bole-centre', 'bole', 'mexico', '2026-10-04T08:00:00+03:00', 3, 'Hana T.', 'Toyota Vitz · Silver', 100, 'sample', 'open'),
  ('sample-dawit', 'bole-centre', 'bole', 'meskel', '2026-10-04T08:15:00+03:00', 2, 'Dawit M.', 'Suzuki Dzire · White', 90, 'sample', 'open'),
  ('sample-selam', 'cmc-centre', 'cmc', 'meskel', '2026-10-04T08:30:00+03:00', 3, 'Selam A.', 'Toyota Yaris · Blue', 110, 'sample', 'open');
