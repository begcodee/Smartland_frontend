import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert, ShieldCheck, CreditCard, ScanFace,
  UploadCloud, AlertCircle, Clock, Lock
} from 'lucide-react';
import { GhanaCardVerification, type VerificationData } from '@/components/GhanaCardVerification';
import { useAuth } from '@/contexts/AuthContext';
import { updateLocalPendingUserVerification } from '@/lib/pendingUsersStore';
import { toast } from '@/lib/appToast';

const RESTRICTED_ROLES = ['seller', 'buyer'] as const;

export function VerificationGateDialog() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<'prompt' | 'verify'>('prompt');
  const [dismissed, setDismissed] = useState(false);

  const alreadySubmitted =
    !!user?.idVerification || user?.identityStatus === 'pending' || user?.identityStatus === 'verified';

  const shouldShow =
    !!user &&
    RESTRICTED_ROLES.includes(user.role as typeof RESTRICTED_ROLES[number]) &&
    user.verificationStatus !== 'verified' &&
    !alreadySubmitted &&
    !dismissed;

  const handleVerificationComplete = (data: VerificationData) => {
    const verificationPayload = { ...data, status: 'pending' as const };
    updateUser({ verificationStatus: 'pending', idVerification: verificationPayload });
    if (user?.id) updateLocalPendingUserVerification(user.id, verificationPayload);
    setDismissed(true);
    toast.success('Ghana Card details saved', {
      description: 'Ghana Lands Commission will review your Ghana Card — updates usually arrive within 24 to 48 hours.',
      duration: 8000,
    });
  };

  if (!shouldShow) return null;

  const roleName = user!.role === 'seller' ? 'Seller' : 'Buyer';

  return (
    <Dialog open modal={false}>
      <DialogContent
        className="max-w-lg bg-card border border-border shadow-2xl rounded-2xl p-0 overflow-hidden"
        hideCloseButton={true}
      >
        {step === 'prompt' ? (
          <>
            {/* Header stripe */}
            <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  Verification Required
                  <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5">Limited access</Badge>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm mt-1">
                  Ghana Lands Commission must approve every buyer and every seller. You can browse the platform, but {roleName.toLowerCase()} transactions stay disabled until your Ghana Card is cleared.
                </DialogDescription>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  Ghana Land Registry requires Ghana Lands Commission approval of your Ghana Card for every buyer and seller — no exceptions — before transactions can proceed.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">To unlock full access you need to complete:</p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ghana Card upload</p>
                      <p className="text-xs text-muted-foreground">Front and back of your Ghana National ID card</p>
                    </div>
                    <UploadCloud className="w-4 h-4 text-muted-foreground ml-auto" />
                  </li>
                  <li className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ScanFace className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Facial recognition</p>
                      <p className="text-xs text-muted-foreground">A live selfie to match against your Ghana Card photo</p>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-muted-foreground ml-auto" />
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Verification takes approximately 2–3 minutes. Your data is encrypted and handled securely.</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex flex-col gap-3">
              <Button
                className="w-full h-11 text-sm font-semibold"
                onClick={() => setStep('verify')}
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Start Verification
              </Button>
              <Button
                variant="ghost"
                className="w-full h-9 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setDismissed(true)}
              >
                Continue browsing — I’ll verify later
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
                <ShieldAlert className="w-5 h-5 text-primary" />
                Ghana Card Identity Verification
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Upload your Ghana Card (front &amp; back) and complete the facial recognition scan to verify your identity.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6">
              <GhanaCardVerification
                onVerificationComplete={handleVerificationComplete}
                userCountry={user?.country || 'GH'}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-muted-foreground"
                onClick={() => setStep('prompt')}
              >
                ← Back
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
