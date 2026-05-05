import { removeLocalPendingUsersByAllNameTokens } from '@/lib/pendingUsersStore';
import { clearGhanaCardDraftsByAllNameTokens } from '@/lib/ghanaCardDraftStore';

const REG_FORM_DRAFT_KEY = 'smartland_registration_form_draft_v1';

function nameMatchesAllTokens(subject: string, fullNamePattern: string): boolean {
  const tokens = fullNamePattern
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length < 2) return false;
  const s = subject.trim().toLowerCase();
  return tokens.every((t) => s.includes(t));
}

const LOCAL_USER_KEY = 'smartland_user_v1';
const TOKEN_KEY = 'smartland_token';

/** Clear local-only artifacts for a display name (pending queue, Ghana Card drafts, registration form draft). */
export function purgeLocalIdentityArtifactsForDisplayName(fullName: string): {
  pendingRemoved: number;
  draftsCleared: number;
  registrationDraftCleared: boolean;
  sessionCleared: boolean;
} {
  const pendingRemoved = removeLocalPendingUsersByAllNameTokens(fullName);
  const draftsCleared = clearGhanaCardDraftsByAllNameTokens(fullName);
  let registrationDraftCleared = false;
  let sessionCleared = false;
  try {
    const raw = localStorage.getItem(REG_FORM_DRAFT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { name?: string };
      const n = typeof p.name === 'string' ? p.name : '';
      if (nameMatchesAllTokens(n, fullName)) {
        localStorage.removeItem(REG_FORM_DRAFT_KEY);
        registrationDraftCleared = true;
      }
    }
  } catch {
    // ignore
  }
  try {
    const rawUser = localStorage.getItem(LOCAL_USER_KEY);
    if (rawUser) {
      const u = JSON.parse(rawUser) as { name?: string };
      const n = typeof u.name === 'string' ? u.name : '';
      if (nameMatchesAllTokens(n, fullName)) {
        localStorage.removeItem(LOCAL_USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        sessionCleared = true;
      }
    }
  } catch {
    // ignore
  }
  return { pendingRemoved, draftsCleared, registrationDraftCleared, sessionCleared };
}

/**
 * Optional startup purge: set `NEXT_PUBLIC_PURGE_LOCAL_IDENTITY_NAMES` to pipe-separated full names, e.g.
 * `Paul Hero Hackman|Leslie Ofosu Kontoh`, then restart dev server once and remove the line.
 */
export function purgeLocalIdentityArtifactsFromEnv(): void {
  const raw = process.env.NEXT_PUBLIC_PURGE_LOCAL_IDENTITY_NAMES;
  if (!raw?.trim()) return;
  const names = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const n of names) purgeLocalIdentityArtifactsForDisplayName(n);
}
