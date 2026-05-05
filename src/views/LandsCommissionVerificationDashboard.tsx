import { useEffect, useMemo, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';
import { CheckCircle2, XCircle, Fingerprint, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { normalizeBackendRole } from '@/lib/backendRole';
import { isLandsCommissionDecisionEmailConfigured, sendLandsCommissionDecisionEmail } from '@/lib/sendLandsCommissionDecisionEmail';
import {
  extractVerificationDecisionChainTx,
  prototypeVerificationDecisionTxHash,
  shortTxHash,
} from '@/lib/verificationChainAnchor';
import { readBackendIdentityReferenceId, readBackendIdentityStatus } from '@/lib/backendIdentity';

type VerificationUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  createdAt: string;
  idVerification?: string | Record<string, unknown> | null;
  identityStatus?: string | null;
  identityReferenceId?: string | null;
  /** Set by API after on-chain approval attestation (GET /users). */
  identityAttestationTxHash?: string | null;
  /** Optional separate anchor for rejections. */
  identityRejectionTxHash?: string | null;
};

function parseIdVerification(raw: unknown) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type DecisionState = 'open' | 'verified' | 'rejected';

function protocolABadge(parsed: Record<string, unknown> | null, state: DecisionState): {
  variant: 'default' | 'outline' | 'secondary' | 'destructive';
  text: string;
} {
  if (state === 'verified') return { variant: 'default', text: 'Verified' };
  if (state === 'rejected') return { variant: 'destructive', text: 'Rejected' };
  if (!parsed) return { variant: 'secondary', text: '—' };
  const sp = parsed.smartlandProtocols as Record<string, unknown> | undefined;
  const protocolA = sp?.protocolA as { passed?: boolean } | undefined;
  if (protocolA?.passed) return { variant: 'default', text: 'OK' };
  return { variant: 'secondary', text: '—' };
}

/** On-device selfie vs card portrait snapshot — superseded once the authority decides. */
function protocolBBadge(parsed: Record<string, unknown> | null, state: DecisionState): {
  variant: 'default' | 'outline' | 'secondary' | 'destructive';
  text: string;
} {
  if (state === 'verified') return { variant: 'default', text: 'Verified' };
  if (state === 'rejected') return { variant: 'destructive', text: 'Rejected' };
  if (!parsed) return { variant: 'secondary', text: '—' };
  const sp = parsed.smartlandProtocols as Record<string, unknown> | undefined;
  const protocolB = sp?.protocolB as
    | { passed?: boolean | null; skipped?: boolean; similarity?: number }
    | undefined;
  const needsManual = parsed.requiresManualReview === true;

  const formatSim = (s: number | undefined) => {
    if (typeof s !== 'number' || !Number.isFinite(s)) return null;
    if (s >= 0 && s <= 1) return `${Math.round(s * 100)}%`;
    return `${Math.round(s)}%`;
  };

  if (protocolB == null || typeof protocolB !== 'object') {
    if (needsManual) return { variant: 'outline', text: 'Manual review' };
    return { variant: 'secondary', text: '—' };
  }
  if (protocolB.skipped === true) {
    const sim = formatSim(protocolB.similarity);
    return { variant: 'outline', text: sim != null ? `Manual (${sim})` : 'Manual review' };
  }
  if (protocolB.passed === true) {
    const sim = formatSim(protocolB.similarity);
    return { variant: 'default', text: sim ?? 'OK' };
  }
  if (protocolB.passed === false && needsManual) {
    return { variant: 'outline', text: 'Manual review' };
  }
  if (protocolB.passed === false) {
    return { variant: 'outline', text: 'Under approval' };
  }
  return { variant: 'secondary', text: '—' };
}

function hasIdVerificationPayload(u: VerificationUser): boolean {
  if (u.idVerification == null) return false;
  if (typeof u.idVerification === 'object') return Object.keys(u.idVerification as object).length > 0;
  return String(u.idVerification).trim().length > 2;
}

/** Normalised identity workflow state for list + actions */
function decisionState(u: VerificationUser): 'open' | 'verified' | 'rejected' {
  const raw = (readBackendIdentityStatus(u) ?? '').toString().trim().toLowerCase();
  if (raw === 'verified') return 'verified';
  if (raw === 'rejected') return 'rejected';
  return 'open';
}

export default function LandsCommissionVerificationDashboard() {
  const [users, setUsers] = useState<VerificationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<VerificationUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      const list = Array.isArray(res.users) ? (res.users as VerificationUser[]) : [];
      /** Everyone except Commission staff rows — reviewers need to see all buyers/sellers/admins/etc. */
      const queue = list
        .filter((u) => String(u.role ?? '').toLowerCase() !== 'lands_commission')
        .sort((a, b) => {
          const pa = decisionState(a) === 'open' ? 0 : 1;
          const pb = decisionState(b) === 'open' ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
        });
      setUsers(queue);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const pending = useMemo(() => users.filter((u) => decisionState(u) === 'open'), [users]);

  const notifyApplicant = async (
    u: VerificationUser,
    approved: boolean,
    resUser: Record<string, unknown> | undefined,
    reason?: string
  ) => {
    if (!isLandsCommissionDecisionEmailConfigured()) return;
    try {
      await sendLandsCommissionDecisionEmail({
        toEmail: u.email,
        name: u.name,
        approved,
        referenceId: readBackendIdentityReferenceId(resUser) ?? u.identityReferenceId ?? null,
        reason: approved ? null : reason ?? null,
      });
    } catch {
      // Decision already persisted
    }
  };

  const runVerify = async (u: VerificationUser) => {
    setBusyId(u.id);
    try {
      const data = await api.landsCommissionDecision(u.id, 'verify');
      const fromApi = extractVerificationDecisionChainTx(data as Record<string, unknown>);
      const anchorTx = fromApi ?? prototypeVerificationDecisionTxHash();
      toast.success(`${u.name}: Lands Commission verification approved`, {
        description: fromApi
          ? `On-chain attestation ${shortTxHash(fromApi)}. Buyers need no separate GLC account step; for sellers, Lands Commission may still assign blockchainToken in Registration Review and verifies each parcel’s documents before listing goes live.`
          : `Simulated attestation ${shortTxHash(anchorTx)} — wire your API to return a real tx hash. Buyers need no separate GLC account step; sellers get blockchainToken / parcel checks via Lands Commission when applicable.`,
        duration: 11000,
      });
      await notifyApplicant(u, true, data.user);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to verify');
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (u: VerificationUser) => {
    setRejectTarget(u);
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const u = rejectTarget;
    setBusyId(u.id);
    try {
      const data = await api.landsCommissionDecision(u.id, 'reject', rejectReason);
      const fromApi = extractVerificationDecisionChainTx(data as Record<string, unknown>);
      const anchorTx = fromApi ?? prototypeVerificationDecisionTxHash();
      toast.success(`${u.name}: Lands Commission verification rejected`, {
        description: fromApi
          ? `Rejection anchored on-chain ${shortTxHash(fromApi)}.`
          : `Simulated rejection anchor ${shortTxHash(anchorTx)} — have your API return a real tx hash for audit.`,
        duration: 9000,
      });
      await notifyApplicant(u, false, data.user, rejectReason);
      setRejectOpen(false);
      setRejectTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout
      role="lands_commission"
      title="Lands Commission Verification Dashboard"
      subtitle="Ghana Lands Commission — Ghana Card (buyers/sellers) + parcel documents (sellers)"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                Identity verification queue
              </CardTitle>
              <CardDescription>
                Every buyer and seller needs your decision — open cases are listed first. Verified or rejected rows stay visible for audit.
                Protocol A is the on-device card capture check; Protocol B is local selfie vs card portrait similarity (uploads and borderline scores are flagged for your review pending approval).
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{users.length} in queue (excl. Commission staff)</Badge>
              <Badge variant="default">{pending.length} need a decision</Badge>
              <Badge variant="outline">{users.length - pending.length} already decided</Badge>
              {isLandsCommissionDecisionEmailConfigured() ? (
                <Badge variant="default" className="text-xs">
                  Email on decision
                </Badge>
              ) : null}
            </div>
            <Separator />

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No users returned. Check that <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_API_URL</code> matches
                the server where people register, and that your Lands Commission login can call <code className="text-xs bg-muted px-1 rounded">GET /users</code>.
              </p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => {
                  const state = decisionState(u);
                  const actionable = state === 'open';
                  const parsed = parseIdVerification(u.idVerification);
                  const gh = (parsed?.ghanaCard as Record<string, unknown> | undefined) ?? parsed;
                  const cardNumber =
                    (gh?.cardNumber as string) ||
                    (parsed?.cardNumber as string | undefined);
                  const fullNameOnCard =
                    (gh?.fullName as string) ||
                    (parsed?.fullName as string | undefined);
                  const selfieSource = parsed?.selfieSource as string | undefined;
                  const protocolAUi = protocolABadge(parsed, state);
                  const protocolBUi = protocolBBadge(parsed, state);
                  const hasCard = hasIdVerificationPayload(u);
                  const displayRole = normalizeBackendRole(u.role);
                  return (
                    <div
                      key={u.id}
                      className={`rounded-xl border p-4 space-y-3 ${
                        actionable ? 'border-border bg-card' : 'border-muted bg-muted/20 opacity-95'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email} · {u.phoneNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Role: <span className="font-medium text-foreground">{displayRole}</span>
                            {' · '}
                            Registered: {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {state === 'verified' ? (
                            <Badge className="bg-emerald-600 text-white">Commission verified</Badge>
                          ) : state === 'rejected' ? (
                            <Badge variant="destructive">Commission rejected</Badge>
                          ) : (
                            <Badge variant="secondary">Awaiting Commission decision</Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-xs">
                            {cardNumber ?? 'No card number on file'}
                          </Badge>
                          {!hasCard ? (
                            <Badge variant="outline" className="text-[10px]">
                              No Ghana Card upload yet
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {hasCard ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={protocolAUi.variant} className="text-xs">
                              Protocol A {protocolAUi.text}
                            </Badge>
                            <Badge variant={protocolBUi.variant} className="text-xs">
                              Protocol B {protocolBUi.text}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Name on card: <span className="text-foreground font-medium">{fullNameOnCard ?? '—'}</span>
                            {selfieSource ? (
                              <span className="ml-2">Selfie: <span className="text-foreground font-medium">{selfieSource}</span></span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No Ghana Card package in the app yet — you can still verify or reject using your own checks.
                        </p>
                      )}
                      {actionable ? (
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => void runVerify(u)} disabled={busyId === u.id}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                          <Button
                            className="flex-1"
                            variant="destructive"
                            onClick={() => openReject(u)}
                            disabled={busyId === u.id}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                          <p className="text-xs text-muted-foreground">No actions — Commission decision already recorded for this account.</p>
                      )}
                      {state === 'verified' && u.identityAttestationTxHash ? (
                        <p className="text-xs text-muted-foreground">
                          On-chain attestation:{' '}
                          <span className="font-mono text-foreground">{shortTxHash(u.identityAttestationTxHash)}</span>
                        </p>
                      ) : null}
                      {state === 'rejected' && u.identityRejectionTxHash ? (
                        <p className="text-xs text-muted-foreground">
                          Rejection chain anchor:{' '}
                          <span className="font-mono text-foreground">{shortTxHash(u.identityRejectionTxHash)}</span>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (!o) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Reject verification</DialogTitle>
            <DialogDescription>
              {rejectTarget ? (
                <>This sets identity status to <strong>rejected</strong> for <strong>{rejectTarget.name}</strong> ({rejectTarget.email}).</>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason (optional but recommended)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Ghana Card images unclear; name mismatch; suspected duplicate account"
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmReject()} disabled={!rejectTarget || busyId === rejectTarget?.id}>
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
