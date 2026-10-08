# Start here

ZEW is a private shared-ride demo for Addis Ababa. Start with the [README](../README.md) and [implementation status](implementation-status.md).

1. Use Node.js 24+, then run `npm run setup` and `npm run dev` from the repository root.
2. Open the public homepage and follow Explore the demo to `/demo`. Try the illustrative fare splitter, a ride circle, and the sample driver flow.
3. Explore `/planned` for booking codes, simulated completion and saved commutes.
4. Run `npm run check` and `npm run build` before committing behavior changes. Browser checks are documented in the README.
5. Follow [deployment](deployment.md) to configure Vercel and a persistent API host. Optional accounts require an email-confirming Supabase Auth project; the demo itself needs no account.

Driver, support and administrator controls are simulated views, not authorization or transport operations. No real payment provider is connected, and the application never asks for a payment PIN.

See [architecture](architecture.md) for code organization and [ride-circle rules](product/ride-circles.md) for matching, readiness and pricing rules.
