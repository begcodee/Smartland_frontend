import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD } from '@/lib/roleDashboard';
import type { User } from '@/lib/mockData';
import { shouldForceBuyerSellerVerificationRoute } from '@/lib/verificationRouting';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles for this route. Empty = any authenticated user */
  allowedRoles?: User['role'][];
}

function hasRequiredRoleCredential(u: User): boolean {
  if (u.role === 'admin' || u.role === 'lands_commission') return Boolean(u.staffId?.trim());
  if (u.role === 'arbitrator') return Boolean(u.arbitratorRegNo?.trim());
  return true;
}

export function ProtectedRoute({ children, allowedRoles = [] }: ProtectedRouteProps) {
  const { isAuthenticated, user, authReady, authHydrating, logout } = useAuth();
  const location = useLocation();

  if (!authReady || authHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!hasRequiredRoleCredential(user)) {
    // Treat missing staff/arbitrator credential as invalid session to prevent UI privilege escalation via cached role.
    logout();
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  const lockedBuyerSellerVerification = shouldForceBuyerSellerVerificationRoute(user);

  const path = location.pathname;
  const paymentOk = path.startsWith('/payment/callback');

  const onVerificationStatusRoute = path === '/verification/status' || path === '/verification-status';

  if (lockedBuyerSellerVerification && !paymentOk && !onVerificationStatusRoute) {
    return <Navigate to="/verification-status" replace />;
  }

  const roleAllowed =
    allowedRoles.length === 0 || allowedRoles.includes(user.role);

  if (!roleAllowed) {
    const correctPath = ROLE_DASHBOARD[user.role];
    return <Navigate to={correctPath} replace />;
  }

  return <>{children}</>;
}
