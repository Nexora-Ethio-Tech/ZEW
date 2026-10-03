# ADR 001: Separate frontend and backend

**Status:** accepted for the pilot starter.

Zew needs public pages, rider/driver interfaces, sensitive business rules, payment webhooks and later potentially native apps. We will use independent `frontend/` and `backend/` applications communicating through a versioned API.

This adds setup work compared with a single full-stack app, but makes the trust boundary clear: matching, money, authorization and audit logic stay on the server. It also means a future native app can use the same API.

