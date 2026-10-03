# Pilot backlog

This is the target real-pilot backlog. A private demo now implements several precursor flows; see [implementation status](../implementation-status.md). Leave production items unchecked until their actual integrations and acceptance criteria are fulfilled.

Work from top to bottom. A ticket is done only when it has a testable acceptance criterion.

## P0 — foundation

- [ ] Landing page with pilot waitlist and privacy notice.
- [ ] Phone-based sign-in with rate limit and verified consent.
- [ ] Rider/driver onboarding with operations approval status.
- [ ] Saved commute and planned driver trip forms.
- [ ] Operator-only review queue.
- [ ] Trip state machine: `draft → offered → matched → confirmed → boarding → in_progress → completed | cancelled`.
- [ ] Audit log for approval, match, cancellation, support, payment events.

## P1 — controlled matching

- [ ] Store route geometry, direction, time window, available seats, and safe pickup points.
- [ ] Produce ranked candidate matches with explainable rejection reasons.
- [ ] Human operations approval before rider notification.
- [ ] Rider/driver accept/decline with timeout.
- [ ] Boarding code and minimal live trip status.

## P2 — after pilot gates pass

- [ ] Payment provider integration using server-side webhook verification.
- [ ] Refund workflow and ledger reconciliation.
- [ ] Automated matching within approved corridors.
- [ ] PWA offline shell, push notifications, install prompt.
