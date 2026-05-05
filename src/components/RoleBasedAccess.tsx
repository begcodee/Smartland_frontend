import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/lib/mockData';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

interface RoleBasedAccessProps {
  allowedRoles: User['role'][];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleBasedAccess = ({ allowedRoles, children, fallback }: RoleBasedAccessProps) => {
  const { user } = useAuth();

  if (!user) {
    return fallback || (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Please log in to access this feature.
        </AlertDescription>
      </Alert>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return fallback || (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access this feature. Required roles: {allowedRoles.join(', ')}.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

export const useRoleAccess = () => {
  const { user } = useAuth();

  const hasRole = (role: User['role']) => user?.role === role;
  const hasAnyRole = (roles: User['role'][]) => user ? roles.includes(user.role) : false;
  const isVerified = () =>
    user?.identityStatus === 'verified' ||
    user?.verificationStatus === 'verified';

  return {
    currentUser: user,
    hasRole,
    hasAnyRole,
    isVerified,
    canRegisterLand: hasAnyRole(['seller', 'admin']),
    canTransferLand: hasAnyRole(['seller', 'buyer']),
    canFileDispute: hasAnyRole(['seller', 'buyer']),
    canVoteOnDispute: hasAnyRole(['seller', 'buyer', 'arbitrator', 'admin']),
    /** Arbitrators are advisory/neutral — they do not execute case outcomes in this prototype. */
    canResolveDispute: hasAnyRole(['admin']),
    canViewContracts: hasAnyRole(['admin', 'arbitrator']),
    canManageUsers: hasRole('admin'),
  };
};