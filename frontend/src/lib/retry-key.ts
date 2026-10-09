// Retain the same command key after an ambiguous network failure, including a reload.
// Storage contains only digests and random keys, never boarding codes or bearer tokens.
const memory = new Map<string, string>();
const prefix = 'zew-retry:';
export async function retryKey(token: string, path: string, method: string, body: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify([token, method, path, body]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id =
    prefix + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  let key = memory.get(id);
  try {
    key ??= sessionStorage.getItem(id) ?? undefined;
  } catch {
    /* Memory fallback. */
  }
  key ??= crypto.randomUUID();
  memory.set(id, key);
  try {
    sessionStorage.setItem(id, key);
  } catch {
    /* Memory fallback. */
  }
  return {
    key,
    finish() {
      memory.delete(id);
      try {
        sessionStorage.removeItem(id);
      } catch {
        /* Memory fallback. */
      }
    },
  };
}
