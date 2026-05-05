import type { User } from '@/lib/mockData';

/**
 * Buyers and sellers must complete Ghana Card identity verification before they can transact.
 * Staff roles (admin, lands_commission) are handled via organisation credentials instead of this gate.
 */
export function needsIdentityVerification(role: User['role']): boolean {
  return role === 'buyer' || role === 'seller';
}

export function isIdentityVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (!needsIdentityVerification(user.role)) return true;
  return user.identityStatus === 'verified';
}

/** True until Lands Commission has approved the user’s Ghana Card identity verification. */
export function isUserRestricted(user: User | null | undefined) {
  if (!user) return false;
  if (!needsIdentityVerification(user.role)) return false;
  return user.identityStatus !== 'verified';
}
