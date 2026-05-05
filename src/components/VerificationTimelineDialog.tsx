import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Mail, Clock } from 'lucide-react';
import {
  VERIFICATION_TIMELINE_SUMMARY,
  VERIFICATION_HOURS_RANGE,
  SIGNUP_TIMELINE_BUYER,
  SIGNUP_TIMELINE_LANDOWNER,
  SIGNUP_TIMELINE_ARBITRATOR,
} from '@/lib/verificationMessaging';
import type { User } from '@/lib/mockData';

type Context = 'signup' | 'ghana_card_submitted';

const titles: Record<Context, string> = {
  signup: 'Account created — verification pending',
  ghana_card_submitted: 'Ghana Card details received'
};

interface VerificationTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: Context;
  /** When context is signup, drives identity + land docs copy. */
  accountRole?: User['role'] | null;
}

function signupBody(role: User['role'] | null | undefined) {
  if (role === 'seller') {
    return (
      <>
        <p className="text-sm leading-relaxed">{SIGNUP_TIMELINE_LANDOWNER}</p>
        <ol className="list-decimal list-inside text-sm space-y-2 text-foreground/90 border border-border rounded-lg p-3 bg-muted/30">
          <li>
            <strong>Identity</strong> — Ghana Card + selfie (after login). Shown on the <strong>Lands Commission dashboard</strong> until approved or rejected.
          </li>
          <li>
            <strong>Ghana Lands Commission</strong> — land title and related documents when you <strong>register each parcel</strong>. Staff review documents and grant or deny permission to list that land.
          </li>
        </ol>
      </>
    );
  }
  if (role === 'buyer') {
    return <p className="text-sm leading-relaxed">{SIGNUP_TIMELINE_BUYER}</p>;
  }
  if (role === 'admin' || role === 'lands_commission') {
    return (
      <p className="text-sm leading-relaxed">
        Staff accounts use organisation credentials. Follow your team’s onboarding if Ghana Card checks apply to your role.
      </p>
    );
  }
  return <p className="text-sm leading-relaxed">{VERIFICATION_TIMELINE_SUMMARY}</p>;
}

export function VerificationTimelineDialog({ open, onOpenChange, context, accountRole }: VerificationTimelineDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground text-left">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            {titles[context]}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left text-foreground/90 pt-2">
              {context === 'signup' ? signupBody(accountRole ?? null) : (
                <p className="text-sm leading-relaxed">{VERIFICATION_TIMELINE_SUMMARY}</p>
              )}
              <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Watch your inbox (and spam folder). Allow <strong>{VERIFICATION_HOURS_RANGE}</strong> for a first response
                  {accountRole === 'seller' ? ' from Ghana Lands Commission as each stage applies' : ''}.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction className="w-full sm:w-auto">I understand</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
