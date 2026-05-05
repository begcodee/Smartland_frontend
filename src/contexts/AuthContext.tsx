import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { User } from '@/lib/mockData';
import { api } from '@/lib/api';
import { normalizeBackendRole } from '@/lib/backendRole';
import { readBackendIdentityReferenceId, readBackendIdentityStatus } from '@/lib/backendIdentity';

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  /** True once we've resolved session state from token/local cache (prevents route flashes). */
  authReady: boolean;
  /** True while fetching `/auth/me` for a stored token. */
  authHydrating: boolean;
  refreshUser: () => Promise<void>;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
const LOCAL_USER_KEY = 'smartland_user_v1';

function writeLocalUser(u: User | null) {
  try {
    if (!u) localStorage.removeItem(LOCAL_USER_KEY);
    else localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
  } catch {
    // ignore
  }
}

function hasSessionToken(): boolean {
  try {
    return Boolean(localStorage.getItem('smartland_token'));
  } catch {
    return false;
  }
}

function mapApiUser(u: {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  verificationStatus?: string;
  verified?: boolean;
  rejectionReason?: string | null;
  country?: string;
  phoneNumber?: string;
  organization?: string;
  staffId?: string;
  arbitratorRegNo?: string;
  blockchainToken?: string;
  idVerification?: string | Record<string, unknown> | null;
  reputation?: object;
  creditScore?: object;
  financialProfile?: object;
}) {
  let idVerification: User['idVerification'];
  if (u.idVerification) {
    if (typeof u.idVerification === 'string') {
      try {
        idVerification = JSON.parse(u.idVerification) as User['idVerification'];
      } catch {
        idVerification = undefined;
      }
    } else if (typeof u.idVerification === 'object') {
      idVerification = u.idVerification as unknown as User['idVerification'];
    }
  }

  const verificationStatus: User['verificationStatus'] =
    u.verified === true
      ? 'verified'
      : u.verificationStatus === 'rejected' || u.rejectionReason
        ? 'rejected'
        : 'pending';

  const identityStatusRaw = readBackendIdentityStatus(u);
  const identityReferenceIdRaw = readBackendIdentityReferenceId(u);

  return {
    id: u.id ?? '',
    name: u.name ?? '',
    email: u.email ?? '',
    role: normalizeBackendRole(u.role),
    verificationStatus,
    country: u.country ?? 'GH',
    phoneNumber: u.phoneNumber ?? '',
    organization: u.organization,
    staffId: u.staffId,
    arbitratorRegNo: u.arbitratorRegNo,
    blockchainToken: u.blockchainToken,
    idVerification,
    identityStatus: (identityStatusRaw as User['identityStatus'] | null) ?? undefined,
    identityReferenceId: identityReferenceIdRaw ?? undefined,
    reputation: u.reputation as User['reputation'],
    creditScore: u.creditScore as User['creditScore'],
    financialProfile: u.financialProfile as User['financialProfile']
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authHydrating, setAuthHydrating] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('smartland_token');
    if (!token) {
      setAuthReady(true);
      setAuthHydrating(false);
      return;
    }
    setAuthHydrating(true);
    try {
      const res = await api.me();
      const rawUser =
        res && typeof res === 'object' && 'success' in res && 'user' in res
          ? (res as { success?: boolean; user?: unknown }).user
          : res;

      if (rawUser && typeof rawUser === 'object') {
        const mapped = mapApiUser(rawUser as Parameters<typeof mapApiUser>[0]);
        setUserState(mapped);
        writeLocalUser(mapped);
      } else {
        setUserState(null);
        writeLocalUser(null);
      }
    } catch {
      api.logout();
      setUserState(null);
      writeLocalUser(null);
    } finally {
      setAuthHydrating(false);
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('smartland_token');
    if (!token) {
      // Cached profile without a JWT cannot call the API — clear stale session to avoid "Missing bearer token".
      writeLocalUser(null);
      setUserState(null);
      setAuthReady(true);
      setAuthHydrating(false);
      return;
    }
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback((u: User) => {
    setUserState(u);
    writeLocalUser(u);
    setAuthReady(true);
    setAuthHydrating(false);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUserState(null);
    writeLocalUser(null);
    setAuthReady(true);
    setAuthHydrating(false);
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    writeLocalUser(u);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUserState((prev) => {
      const next = prev ? { ...prev, ...updates } : null;
      writeLocalUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && hasSessionToken()),
        authReady,
        authHydrating,
        refreshUser,
        login,
        logout,
        setUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
