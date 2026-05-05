/**
 * API origin for web + Capacitor builds.
 * Configure `NEXT_PUBLIC_API_URL` to point at your backend origin.
 */
function normalizeApiBase(raw: string | undefined): string {
  const trimmed = raw != null ? String(raw).trim() : '';
  if (trimmed) {
    let u = trimmed.replace(/\/$/, '');
    if (!u.endsWith('/api')) u = `${u}/api`;
    return u;
  }
  return 'http://localhost:3001/api';
}

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL;

export const API_BASE = normalizeApiBase(API_ORIGIN);

/** Backend serves `GET /health` outside `/api` — use this URL from the browser. */
export function healthCheckUrl(): string {
  if (API_BASE.startsWith('http')) return API_BASE.replace(/\/?api\/?$/i, '') + '/health';
  return '/health';
}
