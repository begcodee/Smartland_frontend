/**
 * Canonical public origin for this SPA (scheme + host + port, no path, no trailing slash).
 * Set `NEXT_PUBLIC_APP_ORIGIN` in `.env.local` to match how users reach the app.
 */
export function getAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://127.0.0.1:3000';
}
