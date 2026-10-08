// Supabase is used only for verified identity; SQLite is the authoritative demo store.
// Fire-and-forget mirroring with a browser key is intentionally not supported.
export { verifyIdentity } from '../modules/auth/service.js';
