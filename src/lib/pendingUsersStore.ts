/**
 * In-memory store for locally registered pending users.
 * Used when the backend is unavailable (prototype / offline mode).
 *
 * Registration flow  →  addLocalPendingUser()
 * Ghana Card verify  →  updateLocalPendingUserVerification()
 * Admin approve/reject → removeLocalPendingUser()
 * Admin dashboard    →  getLocalPendingUsers()
 */

export interface LocalPendingUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  organization?: string | null;
  staffId?: string | null;
  verificationStatus: string;
  /** JSON-stringified VerificationData */
  idVerification?: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'smartland_pending_users_v1';

function readStore(): LocalPendingUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalPendingUser[]) : [];
  } catch {
    return [];
  }
}

function writeStore(next: LocalPendingUser[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota / private mode failures
  }
}

const store: LocalPendingUser[] = readStore();

export function addLocalPendingUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  verificationStatus?: string;
  phoneNumber?: string;
  organization?: string | null;
  staffId?: string | null;
}) {
  if (store.some((u) => u.id === user.id)) return;
  store.push({
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber ?? '',
    role: user.role,
    organization: user.organization ?? null,
    staffId: user.staffId ?? null,
    verificationStatus: user.verificationStatus ?? 'pending',
    idVerification: null,
    createdAt: new Date().toISOString(),
  });
  writeStore(store);
}

export function updateLocalPendingUserVerification(
  userId: string,
  idVerification: object
) {
  const user = store.find((u) => u.id === userId);
  if (user) {
    user.idVerification = JSON.stringify(idVerification);
    user.verificationStatus = 'pending';
    writeStore(store);
  }
}

export function removeLocalPendingUser(userId: string) {
  const idx = store.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    store.splice(idx, 1);
    writeStore(store);
  }
}

/** Each whitespace-separated token (min length 2) must appear in the stored name (case-insensitive). */
export function removeLocalPendingUsersByAllNameTokens(fullName: string): number {
  const tokens = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length < 2) return 0;
  const before = store.length;
  const next = store.filter((u) => {
    const n = u.name.trim().toLowerCase();
    return !tokens.every((t) => n.includes(t));
  });
  if (next.length !== before) {
    store.length = 0;
    store.push(...next);
    writeStore(store);
  }
  return before - next.length;
}

export function getLocalPendingUsers(): LocalPendingUser[] {
  return [...store];
}
