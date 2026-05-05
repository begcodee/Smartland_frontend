import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { GhanaCardVerification, type VerificationData } from '@/components/GhanaCardVerification';
import { useAuth } from '@/contexts/AuthContext';
import { updateLocalPendingUserVerification } from '@/lib/pendingUsersStore';
import { toast } from '@/lib/appToast';

interface VerifyIdentityBannerProps {
  /** Allow parent to dismiss the banner (optional) */
  onDismiss?: () => void;
}

const LOCKED_ROLES = ['seller', 'buyer'];

export function VerifyIdentityBanner({ onDismiss }: VerifyIdentityBannerProps) {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user) return null;

  const isLockedRole = LOCKED_ROLES.includes(user.role);
  const isUnderReview = user.verificationStatus === 'pending' && !!user.idVerification;
  const identityClear = user.identityStatus === 'verified' || user.verificationStatus === 'verified';
  if (identityClear || (dismissed && !isLockedRole)) return null;

  if (isLockedRole && user.identityStatus === 'rejected') {
    return (
      <Alert className="mb-6 flex items-start gap-3 border-destructive/50 bg-destructive/10 pr-4">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
        <AlertDescription className="text-foreground">
          <span className="font-semibold text-destructive">Identity verification was not successful</span>
          {' — '}your Ghana Card / identity check was rejected. Listing, offers, and transactions stay blocked. If you
          received an email, it may include a reference. Contact Ghana Lands Commission support if you need a
          manual review.
        </AlertDescription>
      </Alert>
    );
  }

  const handleVerificationComplete = (data: VerificationData) => {
    const verificationPayload = { ...data, status: 'pending' as const };
    updateUser({ verificationStatus: 'pending', idVerification: verificationPayload });
    if (user?.id) updateLocalPendingUserVerification(user.id, verificationPayload);
    setOpen(false);
    toast.success('Ghana Card details saved', {
      description: 'Ghana Lands Commission must approve every buyer and seller — watch your email; updates usually arrive within 24 to 48 hours.',
      duration: 8000,
    });
  };

  return (
    <>
      <Alert className={`mb-6 flex items-start gap-3 relative ${isLockedRole ? 'border-destructive/40 bg-destructive/8 pr-4' : 'border-accent/60 bg-accent/10 pr-10'}`}>
        {isUnderReview ? (
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
        ) : (
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" style={{ color: isLockedRole ? 'hsl(0 72% 51%)' : 'hsl(42 100% 40%)' }} />
        )}
        <AlertDescription className="text-foreground flex-1">
          {isUnderReview ? (
            <>
              <span className="font-semibold">Verification under review</span>
              {' — '}every buyer and seller must be cleared by Ghana Lands Commission. Your Ghana Card submission was received; expect an update within <strong>24–48 hours</strong>.
            </>
          ) : isLockedRole ? (
            <>
              <span className="font-semibold text-destructive">Ghana Card verification required</span>
              {' — '}Ghana Lands Commission must approve every buyer and seller. Your card is not cleared yet — you cannot list properties, make offers, or complete transactions until review completes.{' '}
            </>
          ) : (
            <>
              <span className="font-semibold">Complete Ghana Card verification</span> to unlock transactions,
              detailed parcel views, and all registry features.{' '}
            </>
          )}
          {!isUnderReview && (
            <Button
              variant="link"
              className="p-0 h-auto text-primary font-semibold underline-offset-2"
              onClick={() => setOpen(true)}
            >
              Verify now →
            </Button>
          )}
        </AlertDescription>
        {!isLockedRole && (
          <button
            type="button"
            onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Ghana Card Identity Verification
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Ghana Lands Commission approval is mandatory for every buyer and every seller. This unlocks transactions, parcel details, and registry actions after your Ghana Card is cleared.
              Your card is used only for identity verification and is handled securely.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            <GhanaCardVerification
              onVerificationComplete={handleVerificationComplete}
              userCountry={user?.country || 'GH'}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
