/**
 * Convenience barrel — prefers `@supabase/ssr` browser client (`createBrowserClient`).
 * Lower-level access: `@/utils/supabase/client`
 */
import { createClient } from '@/utils/supabase/client';
import { checkSupabaseConfigured } from '@/utils/supabase/env';

export { createClient } from '@/utils/supabase/client';
export { checkSupabaseConfigured, getSupabaseCredentials } from '@/utils/supabase/env';

/** True when URL + publishable key are set (NEXT_PUBLIC_*). */
export const isSupabaseConfigured = checkSupabaseConfigured();

if (process.env.NODE_ENV === 'development' && !isSupabaseConfigured) {
  console.warn(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_* — add them to .env.local'
  );
}

/** Shared browser client; `null` if env is missing (does not throw). */
export function getSupabase() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function requireSupabase() {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local'
    );
  }
  return c;
}
