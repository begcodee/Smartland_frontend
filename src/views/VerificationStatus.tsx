import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_DASHBOARD } from '@/lib/roleDashboard';
import { GhanaCardVerification, type VerificationData } from '@/components/GhanaCardVerification';

export default function VerificationStatusPage() {
  const { user, updateUser } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  // State-aware router logic (DB-driven via /auth/me; local fallback also persists).
  const identity = user.identityStatus ?? null;
  const lands = user.verificationStatus;
  const isSeller = user.role === 'seller';

  // Identity success for everyone on this flow: Ghana Card approved by Lands Commission.
  if (identity === 'verified') {
    return <Navigate to={ROLE_DASHBOARD[user.role]} replace />;
  }

  // FAILED = identity rejected, or seller rejected at Ghana Lands Commission account level.
  if (identity === 'rejected' || (isSeller && lands === 'rejected')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-xl">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Verification failed
            </CardTitle>
            <CardDescription>
              Your verification could not be completed. If you believe this is an error, contact support or request a manual review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant="secondary">Status: Rejected</Badge>
            <Button variant="outline" onClick={() => window.location.href = ROLE_DASHBOARD[user.role]}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PENDING = awaiting Ghana Lands Commission (Ghana Card submitted or queued).
  const underReview = identity === 'pending' || (identity == null && !!user.idVerification);

  if (underReview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-xl">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Under review
            </CardTitle>
            <CardDescription>
              Your Ghana Card submission was received. Ghana Lands Commission will update your identity status within <strong>24–48 hours</strong>.
              {isSeller ? (
                <>
                  {' '}
                  As a <strong>seller</strong>, Ghana Lands Commission will separately review <strong>land documents</strong> for each parcel you list before buyers see it as cleared for sale.
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Identity: {identity ?? 'not submitted'} · Lands Commission (account): {lands}</span>
            </div>
            <Badge variant="secondary">Read-only</Badge>
            <p className="text-xs text-muted-foreground">
              {isSeller
                ? 'Purchases and other actions unlock after Ghana Lands Commission approves your Ghana Card. Listing parcels for sale still requires Lands Commission approval of each parcel’s documents.'
                : 'Purchases and other actions unlock after Ghana Lands Commission approves your Ghana Card.'}
              {' '}You can sign out and sign back in anytime — your submission stays on file.
            </p>
            <Button onClick={() => (window.location.href = ROLE_DASHBOARD[user.role])}>
              Continue to dashboard (browsing mode)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // NULL / NOT SUBMITTED = show upload/verification flow (but prevent re-submit if already saved).
  const alreadySubmitted = !!user.idVerification;

  const handleVerificationComplete = (data: VerificationData) => {
    const verificationPayload = { ...data, status: 'pending' as const };
    updateUser({ verificationStatus: 'pending', idVerification: verificationPayload, identityStatus: 'pending' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Ghana Card verification
          </CardTitle>
          <CardDescription>
            <strong>Every buyer and every seller</strong> must be approved by Ghana Lands Commission using their Ghana Card — that step is mandatory for all. Sellers still need Lands Commission to approve each parcel’s documents before a listing goes live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alreadySubmitted ? (
            <div className="space-y-3">
              <Badge variant="secondary">Already submitted</Badge>
              <p className="text-sm text-muted-foreground">
                Your verification is already on file. Refreshing won’t restart it.
              </p>
              <Button onClick={() => window.location.href = "/verification-status"}>View status</Button>
            </div>
          ) : (
            <GhanaCardVerification onVerificationComplete={handleVerificationComplete} userCountry={user.country || 'GH'} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

