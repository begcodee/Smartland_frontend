import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Wallet, Star, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';

type UiState = 'loading' | 'success' | 'error' | 'need_login' | 'settlement_blocked';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<UiState>('loading');
  const [message, setMessage] = useState('');
  const [transfer, setTransfer] = useState<{ id: string; sellerId: string; buyerId: string } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [stars, setStars] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setState('error');
      setMessage('Missing transaction reference. Return to the registry and try again.');
      toast.error('Payment confirmation failed', {
        description: 'Missing transaction reference. Return to the registry and try again.',
      });
      return;
    }

    const token = localStorage.getItem('smartland_token');
    if (!token) {
      setState('need_login');
      setMessage('Sign in to confirm your payment and update your land records.');
      toast.error('Sign in required', {
        description: 'Sign in to confirm your payment and update your land records.',
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.verifyLandPayment(reference);
        if (cancelled) return;
        if (res.status === 'success') {
          setState('success');
          setMessage(
            'Your payment was confirmed and your registry record has been updated.'
          );
          toast.success('Payment confirmed', {
            description: 'Your registry record has been updated.',
          });
          if (res.transfer?.id && res.transfer?.sellerId && res.transfer?.buyerId) {
            setTransfer({ id: res.transfer.id, sellerId: res.transfer.sellerId, buyerId: res.transfer.buyerId });
            setShowRating(true);
          }
        } else if (res.status === 'success_no_transfer') {
          setState('settlement_blocked');
          setMessage(
            res.message ??
              'Payment was received but automated settlement did not run — a red flag or conflict blocked the registrar and on-chain anchor. Contact support or wait for arbitrator review.'
          );
          toast.message('Payment received — settlement on hold', {
            description:
              res.message ??
              'Automated settlement did not run. Contact support or wait for arbitrator review.',
            duration: 12000,
          });
        } else {
          setState('error');
          setMessage(
            `Payment status: ${res.status}. If you completed payment, wait a moment and check My transfers, or contact support.`
          );
          toast.error('Could not confirm payment', {
            description: `Status: ${res.status}. You can retry from My transfers or contact support.`,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setState('error');
        const msg = e instanceof Error ? e.message : 'Could not verify payment.';
        setMessage(msg);
        toast.error('Payment verification failed', { description: msg });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const submitRating = async () => {
    if (!transfer) return;
    if (stars < 1 || stars > 5) return;
    setSubmittingRating(true);
    try {
      // Buyer rates Seller (Uber-style after purchase)
      await api.createRating({ toUserId: transfer.sellerId, stars, transferId: transfer.id });
      setRatingDone(true);
      setShowRating(false);
      toast.success('Thank you — your rating was submitted.');
    } catch (e) {
      // Keep dialog open; user can retry
      const msg = e instanceof Error ? e.message : 'Could not submit rating.';
      setMessage(msg);
      toast.error('Rating not submitted', { description: msg });
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Payment confirmation
          </CardTitle>
          <CardDescription>
            Secure checkout confirmation for land purchases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Validating payment…
              </p>
            </div>
          )}

          {state === 'success' && (
            <Alert className="border-green-200 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-100 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {state === 'settlement_blocked' && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {(state === 'error' || state === 'need_login') && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {(state === 'success' || state === 'settlement_blocked') && (
            <Button className="w-full" onClick={() => navigate('/buyer')}>
              Back to buyer dashboard
            </Button>
          )}

          {state === 'need_login' && (
            <Button className="w-full" asChild variant="secondary">
              <Link to="/">Sign in</Link>
            </Button>
          )}

          {state === 'error' && (
            <Button className="w-full" variant="outline" onClick={() => navigate('/buyer')}>
              Back to registry
            </Button>
          )}

          {ratingDone && (
            <Alert className="border-primary/25 bg-primary/5 text-foreground">
              <Star className="h-4 w-4 text-primary" />
              <AlertDescription>
                Thank you — your rating was submitted.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRating} onOpenChange={setShowRating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate this transaction</DialogTitle>
            <DialogDescription>
              Help the community by rating the seller (1–5 stars).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 py-3">
            {Array.from({ length: 5 }).map((_, i) => {
              const n = i + 1;
              const active = stars >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className="p-1"
                  aria-label={`${n} star`}
                >
                  <Star className={`h-7 w-7 ${active ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={submitRating}
              disabled={submittingRating || stars < 1}
            >
              {submittingRating ? 'Submitting…' : 'Submit rating'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRating(false)}
              disabled={submittingRating}
            >
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
