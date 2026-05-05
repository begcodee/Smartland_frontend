import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, User } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';
import { useAuth } from '@/contexts/AuthContext';

type TransferRow = {
  id: string;
  status: string;
  createdAt?: string | null;
  parcel?: { id: string; title: string } | null;
  buyerId: string;
  sellerId: string;
  buyer?: { id: string; name: string; email?: string } | null;
  rating?: { counterpartyId: string; alreadyRated: boolean; canRate: boolean } | null;
};

export function SellerSalesRatings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [ratingFor, setRatingFor] = useState<TransferRow | null>(null);
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const mySales = useMemo(() => {
    if (!user) return [];
    return rows.filter((t) => String(t.sellerId) === String(user.id));
  }, [rows, user]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.getTransfers();
      if (res?.success && Array.isArray(res.transfers)) {
        setRows(res.transfers as TransferRow[]);
      }
    } catch {
      // silent (demo mode)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!user || !ratingFor) return;
    if (stars < 1 || stars > 5) return;
    const buyerId = ratingFor.buyerId;
    setSubmitting(true);
    try {
      await api.createRating({ toUserId: buyerId, stars, transferId: ratingFor.id });
      toast.success('Rating submitted');
      setRows((prev) =>
        prev.map((t) =>
          t.id === ratingFor.id
            ? { ...t, rating: { ...(t.rating || { counterpartyId: buyerId }), alreadyRated: true, canRate: false } }
            : t
        )
      );
      setRatingFor(null);
      setStars(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || user.role !== 'seller') return null;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Sales ratings
        </CardTitle>
        <CardDescription>Rate buyers after a completed purchase (community trust score).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading your sales…' : `${mySales.length} sale(s) found`}
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && mySales.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No completed sales yet. Once a buyer purchases a parcel, you’ll be able to rate them here.
          </div>
        )}

        {!loading && mySales.slice(0, 8).map((t) => {
          const buyerName = t.buyer?.name || 'Buyer';
          const parcelTitle = t.parcel?.title || 'Parcel';
          const rated = !!t.rating?.alreadyRated;
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{parcelTitle}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {buyerName}</span>
                  <span>·</span>
                  <span className="font-mono">{t.id.slice(0, 10)}…</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rated ? (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                    Rated
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => setRatingFor(t)}>
                    Rate buyer
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!ratingFor} onOpenChange={(o) => { if (!o) { setRatingFor(null); setStars(0); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate buyer</DialogTitle>
            <DialogDescription>
              How was the buyer’s communication and payment behavior? (1–5 stars)
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
            <Button className="flex-1" onClick={submit} disabled={submitting || stars < 1}>
              {submitting ? 'Submitting…' : 'Submit rating'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setRatingFor(null)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

