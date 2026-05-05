import type { User } from '@/lib/mockData';

/**
 * Force buyers/sellers into the verification flow until Ghana Card identity is approved.
 */
export function shouldForceBuyerSellerVerificationRoute(user: User | null | undefined): boolean {
  if (!user) return false;
  const isBuyerOrSeller = user.role === 'buyer' || user.role === 'seller';
  if (!isBuyerOrSeller) return false;
  return user.identityStatus !== 'verified';
}
