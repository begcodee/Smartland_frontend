import type { User } from '@/lib/mockData';

/** Map API role strings to dashboard routes (backend uses `lands_commission` for GLC admins). */
export function normalizeBackendRole(role: string | undefined | null): User['role'] {
  const r = String(role ?? 'buyer').toLowerCase();
  if (r === 'lands_commission') return 'lands_commission';
  if (r === 'landowner' || r === 'land_owner' || r === 'owner') return 'seller';
  if (r === 'admin' || r === 'seller' || r === 'buyer' || r === 'arbitrator' || r === 'lands_commission') {
    return r;
  }
  return 'buyer';
}
