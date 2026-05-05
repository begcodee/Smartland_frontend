import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileCheck, Shield, Bell } from 'lucide-react';
import { toast } from '@/lib/appToast';
import { api } from '@/lib/api';
import { mapApiParcelToLandParcel } from '@/lib/parcelMapper';
import type { LandParcel } from '@/lib/mockData';
import { mergeParcelDocumentVerification, setParcelDocumentVerificationOverride } from '@/lib/parcelGlcOverrides';
import { normalizeBackendRole } from '@/lib/backendRole';

type QueueParcel = LandParcel & { effectiveDoc: 'pending' | 'verified' | 'rejected' };

export function ParcelDocumentReview() {
  const [parcels, setParcels] = useState<QueueParcel[]>([]);
  const [verifiedSellerCount, setVerifiedSellerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, usersRes] = await Promise.all([
        api.getParcels().catch(() => null),
        api.getUsers().catch(() => null),
      ]);
      if (usersRes?.users && Array.isArray(usersRes.users)) {
        const ready = (usersRes.users as Record<string, unknown>[]).filter((u) => {
          const role = normalizeBackendRole(String(u.role ?? ''));
          if (role !== 'seller') return false;
          return String((u as Record<string, unknown>).identityStatus ?? '').toLowerCase() === 'verified';
        }).length;
        setVerifiedSellerCount(ready);
      } else {
        setVerifiedSellerCount(0);
      }

      if (pr?.success && Array.isArray(pr.parcels)) {
        const mapped = (pr.parcels as object[]).map((p) => {
          const m = mapApiParcelToLandParcel(p as Parameters<typeof mapApiParcelToLandParcel>[0]);
          const effectiveDoc = mergeParcelDocumentVerification(m.id, m.documentsVerificationStatus);
          return { ...m, effectiveDoc } as QueueParcel;
        });
        setParcels(mapped.filter((p) => p.effectiveDoc !== 'verified'));
      } else {
        setParcels([]);
      }
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const h = () => void load();
    window.addEventListener('smartland-parcel-glc-updated', h);
    return () => window.removeEventListener('smartland-parcel-glc-updated', h);
  }, [load]);

  const mark = async (p: QueueParcel, next: 'verified' | 'rejected') => {
    setBusyId(p.id);
    try {
      setParcelDocumentVerificationOverride(p.id, next);
      toast.success(next === 'verified' ? 'Documents marked verified' : 'Documents marked rejected', {
        description: `${p.title} — ${next === 'verified' ? 'Listing can go live for buyers on this device.' : 'Seller should revise and resubmit.'}`,
        duration: 8000,
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const openDoc = async (fileId: string) => {
    try {
      const tok = await api.getFileToken(fileId);
      const blob = await api.downloadFileByToken(tok.token);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // cleanup later
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error('Could not open document', {
        description: e instanceof Error ? e.message : 'Failed',
      });
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-foreground text-xl">
              <FileCheck className="h-5 w-5 text-primary" />
              Parcel document review (Ghana Lands Commission)
            </CardTitle>
            <CardDescription>
              After Ghana Lands Commission verifies a seller’s Ghana Card, they may register parcels here. Each parcel stays <strong>off the buyer market</strong> until you confirm
              documents and ownership are genuine. Approve or reject below (prototype: stored in this browser until your API supports{' '}
              <code className="text-xs bg-muted px-1 rounded">PATCH /parcels/:id</code>).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {verifiedSellerCount > 0 ? (
          <Alert className="border-primary/40 bg-primary/5">
            <Bell className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-foreground">
              <strong>{verifiedSellerCount}</strong> seller account{verifiedSellerCount === 1 ? '' : 's'} ha{verifiedSellerCount === 1 ? 's' : 've'} Ghana Card identity cleared — you can proceed with registry and parcel checks for those landowners.
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading parcels…
          </div>
        ) : parcels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No parcels awaiting document verification — or none returned from the API.</p>
        ) : (
          <div className="space-y-3">
            {parcels.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{p.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.location.address}</p>
                  </div>
                  <Badge variant={p.effectiveDoc === 'rejected' ? 'destructive' : 'secondary'}>
                    {p.effectiveDoc === 'rejected' ? 'Rejected' : 'Pending GLC'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner: <span className="text-foreground font-medium">{p.owner}</span> · Documents: {p.documents?.length ?? 0}
                </p>
                {Array.isArray(p.documents) && p.documents.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.documents.map((d: unknown, idx: number) => {
                      const doc = (d ?? {}) as Record<string, unknown>;
                      const fileId = typeof doc.fileId === 'string' ? doc.fileId : undefined;
                      const name = typeof doc.name === 'string' ? doc.name : undefined;
                      return (
                        <Button
                          key={fileId ? `doc-${fileId}` : `doc-${idx}`}
                          size="sm"
                          variant="outline"
                          disabled={!fileId}
                          onClick={() => fileId && void openDoc(fileId)}
                        >
                          View {name ?? `Document ${idx + 1}`}
                        </Button>
                      );
                    })}
                  </div>
                ) : null}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === p.id || p.effectiveDoc === 'rejected'}
                    onClick={() => void mark(p, 'verified')}
                  >
                    <Shield className="h-4 w-4 mr-1.5" />
                    Verify documents & release listing
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busyId === p.id}
                    onClick={() => void mark(p, 'rejected')}
                  >
                    Reject documents
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
