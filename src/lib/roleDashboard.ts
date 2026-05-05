import type { User } from '@/lib/mockData';

/** Base path for each role after login */
export const ROLE_DASHBOARD: Record<User['role'], string> = {
  admin: '/admin',
  lands_commission: '/lands-commission',
  seller: '/seller',
  buyer: '/buyer',
  arbitrator: '/arbitrator',
};
