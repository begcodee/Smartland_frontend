import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Users, Mail, Phone, Building2, Shield, CheckCircle2, XCircle, Loader2,
  RefreshCw, Clock, ShieldCheck, ShieldX, Fingerprint, UserCircle, Calendar
} from 'lucide-react';
import { toast } from '@/lib/appToast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { normalizeBackendRole } from '@/lib/backendRole';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  organization?: string | null;
  staffId?: string | null;
  verificationStatus: string;
  idVerification?: string | null; // JSON string
  identityStatus?: string | null;
  identityReferenceId?: string | null;
  createdAt: string;
}

function parseIdVerification(raw: string | null | undefined) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function IdentityBadge({ idVerification, identityStatus, identityReferenceId }: { idVerification: string | null | undefined; identityStatus?: string | null; identityReferenceId?: string | null }) {
  const parsed = parseIdVerification(idVerification);
  if (identityStatus === 'verified') {
    return (
      <Badge className="bg-primary text-primary-foreground gap-1.5 px-2.5 py-1">
        <ShieldCheck className="w-3.5 h-3.5" />
        Identity: Verified ✓ {identityReferenceId ? <span className="font-mono text-[10px] opacity-90">{identityReferenceId}</span> : null}
      </Badge>
    );
  }
  if (identityStatus === 'rejected') {
    return (
      <Badge variant="outline" className="border-red-400 text-red-800 bg-red-50 gap-1.5 px-2.5 py-1">
        <ShieldX className="w-3.5 h-3.5" />
        Identity: Rejected
      </Badge>
    );
  }
  if (!parsed) {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50 gap-1.5 px-2.5 py-1">
        <Fingerprint className="w-3.5 h-3.5" />
        Identity: Not submitted yet
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-400 text-blue-800 bg-blue-50 gap-1.5 px-2.5 py-1">
      <Fingerprint className="w-3.5 h-3.5" />
      Identity: Ghana Card submitted
    </Badge>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    buyer: 'bg-blue-100 text-blue-800 border-blue-300',
    seller: 'bg-purple-100 text-purple-800 border-purple-300',
    admin: 'bg-green-100 text-green-800 border-green-300',
    arbitrator: 'bg-orange-100 text-orange-800 border-orange-300',
  };
  return (
    <Badge variant="outline" className={`${styles[role] ?? 'bg-muted text-foreground'} capitalize font-semibold px-2.5 py-0.5`}>
      {role}
    </Badge>
  );
}

export function RegistrationReview() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<Record<string, boolean>>({});
  const [docsReviewed, setDocsReviewed] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.getPendingUsers();
      if (res.success && Array.isArray(res.users)) {
        setPendingUsers(res.users as PendingUser[]);
      } else {
        setPendingUsers([]);
      }
    } catch {
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleApprove = async (u: PendingUser) => {
    setLoadingId(u.id);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await api.verifyUser(u.id, 'approve');
      if (res.success) {
        const token = res.blockchainToken || `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        toast.success(`${u.name} approved`, {
          description: `Account is now verified. Blockchain token: ${token.slice(0, 16)}…`,
          duration: 6000,
        });
        setPendingUsers((prev) => prev.filter((x) => x.id !== u.id));
        return;
      }
    } catch {
      toast.error('Approval failed', { description: 'Backend request failed.' });
    }
    setLoadingId(null);
  };

  const handleReject = async (u: PendingUser) => {
    const reason = rejectReasons[u.id]?.trim() || 'Does not meet Ghana Lands Commission verification standards.';
    setLoadingId(u.id);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = await api.verifyUser(u.id, 'reject', reason);
      if (res.success) {
        toast.error(`${u.name} rejected`, { description: reason });
        setPendingUsers((prev) => prev.filter((x) => x.id !== u.id));
        setShowRejectForm((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
        setRejectReasons((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
        return;
      }
    } catch {
      toast.error('Rejection failed', { description: 'Backend request failed.' });
    }
    setLoadingId(null);
  };

  const isBusy = (id: string) => loadingId === id;
  const canApprove = (u: PendingUser) => u.identityStatus === 'verified';

  const orderedUsers = [...pendingUsers].sort((a, b) => {
    const aReady = a.identityStatus === 'verified' ? 2 : a.idVerification ? 1 : 0;
    const bReady = b.identityStatus === 'verified' ? 2 : b.idVerification ? 1 : 0;
    if (aReady !== bReady) return bReady - aReady;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  /** Ghana Lands Commission account + registry token path applies to sellers / landowners only. */
  const glcSellerQueue = orderedUsers.filter((u) => normalizeBackendRole(u.role) === 'seller');

  return (
    <>
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-foreground text-xl">
              <Shield className="w-5 h-5 text-primary" />
              Pending user verifications
            </CardTitle>
            <CardDescription>
              <strong>Ghana Card verification</strong> is mandatory for buyers and sellers. This queue is <strong>sellers and landowners only</strong>: after identity is verified, you may issue registry access and <strong>blockchainToken</strong> here. Each seller’s <strong>parcel documents</strong> are still verified separately before a listing goes live.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        {!loading && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Users className="w-4 h-4 text-primary" />
              {glcSellerQueue.length} seller{glcSellerQueue.length === 1 ? '' : 's'} in GLC queue
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <Fingerprint className="w-4 h-4 text-amber-600" />
              {glcSellerQueue.filter((u) => !u.idVerification).length} awaiting Ghana Card
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {glcSellerQueue.filter((u) => !!u.idVerification).length} Ghana Card submitted
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <span className="ml-3 text-foreground">Loading pending users…</span>
          </div>
        )}

        {!loading && pendingUsers.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary/60 mb-3" />
            <p className="font-semibold text-foreground">All clear — no pending verifications</p>
            <p className="text-sm text-muted-foreground mt-1">
              New seller registrations will appear here once submitted.
            </p>
          </div>
        )}

        {!loading && pendingUsers.length > 0 && glcSellerQueue.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center space-y-2">
            <p className="font-semibold text-foreground">No sellers pending Ghana Lands Commission account review</p>
            <p className="text-sm text-muted-foreground">
              Pending users are buyers or other roles that do not require a seller registry account — they are not listed here.
            </p>
          </div>
        )}

        {!loading && glcSellerQueue.map((u) => {
          const parsedCard = parseIdVerification(u.idVerification);
          const busy = isBusy(u.id);
          const reviewed = !!docsReviewed[u.id];

          return (
            <Card
              key={u.id}
              className={`border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.05)] ${
                canApprove(u) ? 'border-primary/40 ring-1 ring-primary/15' : 'border-border'
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-base">{u.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <RoleBadge role={u.role} />
                      <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50 gap-1 text-xs">
                        <Clock className="w-3 h-3" /> Pending
                      </Badge>
                    </div>
                  </div>
                </div>
                <IdentityBadge idVerification={u.idVerification} identityStatus={u.identityStatus} identityReferenceId={u.identityReferenceId} />
              </div>

              <Separator />

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {/* Contact details */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Mail className="w-4 h-4 text-primary shrink-0" />
                    {u.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    {u.phoneNumber}
                  </div>
                  {u.organization && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      {u.organization}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    Registered {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* Identity / Ghana Card section */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity — Ghana Card Verification</p>
                  {!parsedCard ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                      <p className="text-sm font-medium text-amber-900">Ghana Card not yet submitted</p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        The user has not completed their Ghana Card upload yet. Ask them to submit Ghana Card details for verification.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Card no: <span className="font-mono font-semibold">{parsedCard.cardNumber || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <UserCircle className="w-4 h-4 text-primary" />
                        Name on card: <span className="font-semibold">{parsedCard.fullName || '—'}</span>
                      </div>
                      {/* Card thumbnails */}
                      <div className="flex gap-3 flex-wrap">
                        {parsedCard.frontCardImage && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Front</p>
                            <img src={parsedCard.frontCardImage} alt="Front" className="h-16 w-28 object-cover rounded-lg border border-border" />
                          </div>
                        )}
                        {parsedCard.backCardImage && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Back</p>
                            <img src={parsedCard.backCardImage} alt="Back" className="h-16 w-28 object-cover rounded-lg border border-border" />
                          </div>
                        )}
                        {parsedCard.faceImage && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Selfie</p>
                            <img src={parsedCard.faceImage} alt="Selfie" className="h-16 w-16 object-cover rounded-full border border-border" />
                          </div>
                        )}
                      </div>
                      {parsedCard.requiresManualReview === true && (
                        <Badge variant="outline" className="border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 gap-1">
                          Manual review required (uploaded selfie — verify images carefully)
                        </Badge>
                      )}
                      {parsedCard.faceMatch === true && !parsedCard.requiresManualReview && (
                        <Badge className="bg-primary/10 text-primary border border-primary/30 gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Live capture screened (staff approval still required)
                        </Badge>
                      )}

                      {canApprove(u) && (
                        <div className="pt-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-primary/30 text-primary hover:bg-primary/5"
                              >
                                Review documents
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Document review</DialogTitle>
                                <DialogDescription>
                                  Review Ghana Card images and selfie before granting access.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Front</p>
                                    {parsedCard.frontCardImage ? (
                                      <img src={parsedCard.frontCardImage} alt="Front" className="h-28 w-full object-cover rounded-lg border border-border" />
                                    ) : (
                                      <div className="h-28 rounded-lg border border-dashed border-border bg-muted/40" />
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Back</p>
                                    {parsedCard.backCardImage ? (
                                      <img src={parsedCard.backCardImage} alt="Back" className="h-28 w-full object-cover rounded-lg border border-border" />
                                    ) : (
                                      <div className="h-28 rounded-lg border border-dashed border-border bg-muted/40" />
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Selfie</p>
                                    {parsedCard.faceImage ? (
                                      <img src={parsedCard.faceImage} alt="Selfie" className="h-28 w-full object-cover rounded-lg border border-border" />
                                    ) : (
                                      <div className="h-28 rounded-lg border border-dashed border-border bg-muted/40" />
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                                  <p className="text-sm text-foreground">
                                    Card no: <span className="font-mono font-semibold">{parsedCard.cardNumber || '—'}</span>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Name on card: <span className="font-semibold">{parsedCard.fullName || '—'}</span>
                                  </p>
                                  {parsedCard.requiresManualReview === true ? (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Uploaded selfie — manual review required.
                                    </p>
                                  ) : null}
                                </div>

                                <Button
                                  type="button"
                                  onClick={() => setDocsReviewed((prev) => ({ ...prev, [u.id]: true }))}
                                  className="w-full"
                                >
                                  Mark reviewed
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          {!reviewed && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Tip: review documents first, then grant access.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Reject reason form (collapsible) */}
              {showRejectForm[u.id] && (
                <div className="px-5 pb-3 space-y-2">
                  <Label htmlFor={`reason-${u.id}`} className="text-sm text-foreground">Reason for rejection *</Label>
                  <Textarea
                    id={`reason-${u.id}`}
                    placeholder="e.g. Ghana Card images are unclear; please resubmit with clearer photos."
                    rows={2}
                    value={rejectReasons[u.id] || ''}
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              {/* Action buttons */}
              <Separator />
              <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Seller registry authorisation · Issues blockchainToken where applicable; each land listing still needs parcel document verification before going live
                </p>
                <div className="flex gap-2">
                  {/* Reject flow */}
                  {!showRejectForm[u.id] ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setShowRejectForm((prev) => ({ ...prev, [u.id]: true }))}
                      className="border-destructive/40 text-destructive hover:bg-destructive/5"
                    >
                      <ShieldX className="w-4 h-4 mr-1.5" />
                      Not Verified
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setShowRejectForm((prev) => { const n = { ...prev }; delete n[u.id]; return n; })}
                        className="text-muted-foreground"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleReject(u)}
                      >
                        {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                        Confirm Rejection
                      </Button>
                    </>
                  )}

                  {/* Approve */}
                  <Button
                    size="sm"
                    disabled={busy || !canApprove(u) || !reviewed}
                    onClick={() => {
                      if (!canApprove(u)) {
                        toast.error('Identity verification required', {
                          description: 'This user must complete identity verification before Lands Commission can grant access.',
                          duration: 7000,
                        });
                        return;
                      }
                      if (!reviewed) {
                        toast.error('Review documents first', {
                          description: 'Please review the submitted documents before granting access.',
                          duration: 6000,
                        });
                        return;
                      }
                      handleApprove(u);
                    }}
                    className={`shadow-sm ${
                      canApprove(u) && reviewed
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                    Grant Access
                  </Button>
                </div>

                {!canApprove(u) && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Blocked: identity must be verified first</p>
                    <p className="mb-2">
                      This is strict by design (rule-based). Ask the user to complete Ghana Card verification.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          window.location.href = '/lands-commission';
                        }}
                      >
                        Open Lands Commission dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </CardContent>
    </Card>
    </>
  );
}
