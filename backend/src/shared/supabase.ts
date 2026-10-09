// Identity uses Supabase Auth. Hosted persistence uses the private Postgres repository.
// Fire-and-forget mirroring with a browser key is intentionally not supported.
export { verifyIdentity } from '../modules/auth/service.js';
