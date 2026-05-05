import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';
import { Gavel, ShieldAlert, FileText, MessagesSquare } from 'lucide-react';

type CaseRow = {
  parcelId: string;
  title: string;
  status: string;
  registryClearance: string;
  redFlag?: { code?: string; message?: string; raisedAt?: string } | null;
  createdAt?: string | null;
};

function EvidenceDialog({ row, onActionComplete }: { row: CaseRow; onActionComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<unknown>(null);
  const [acting, setActing] = useState(false);
  const [officialReviewStarted, setOfficialReviewStarted] = useState(false);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const ev = await api.getArbitrationEvidence(row.parcelId);
      setEvidence(ev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load evidence');
      setEvidence(null);
    } finally {
      setLoading(false);
    }
  }, [row.parcelId]);

  useEffect(() => {
    if (!open) return;
    void loadEvidence();
  }, [open, loadEvidence]);

  const startOfficialReview = async () => {
    // Advisory-only: revealing identities enables consultation, but does not change parcel status or transactions.
    setActing(true);
    try {
      setOfficialReviewStarted(true);
      toast.success('Consultation mode enabled. Identities are now visible for advisory support.');
      await loadEvidence();
    } finally {
      setActing(false);
    }
  };

  const ev = (evidence ?? {}) as Record<string, unknown>;
  const parcel = ev.parcel as Record<string, unknown> | undefined;
  const seller = ev.seller as Record<string, unknown> | undefined;
  const conversations = Array.isArray(ev.conversations) ? (ev.conversations as unknown[]) : [];
  const sellerProtocols = ev.sellerProtocols as Record<string, unknown> | undefined;
  const protocolA = sellerProtocols?.protocolA as { passed?: boolean } | undefined;
  const protocolB = sellerProtocols?.protocolB as { passed?: boolean; skipped?: boolean } | undefined;

  const caseIdentitySummary = useMemo(() => {
    if (!seller) return 'Seller: Unknown';
    if (!officialReviewStarted) return 'Seller: (hidden until Official Review)';
    return `Seller: ${seller.name ?? seller.id}`;
  }, [seller, officialReviewStarted]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Open case file</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Arbitration Case — {row.parcelId}
          </DialogTitle>
          <DialogDescription>
            Neutral review. Identities are hidden until you start Official Review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
            <div className="min-w-0">
              <p className="font-medium">{row.title}</p>
              <p className="text-xs font-mono text-muted-foreground">{row.parcelId}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{row.redFlag?.code ?? 'CASE'}</Badge>
                <Badge variant="secondary">{row.status}</Badge>
                <Badge variant="secondary">{row.registryClearance}</Badge>
              </div>
            </div>
            <Button onClick={() => void startOfficialReview()} disabled={acting || officialReviewStarted}>
              {officialReviewStarted ? 'Consultation enabled' : 'Enable consultation (reveal identities)'}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading evidence…</p>
          ) : evidence ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4" />
                    Evidence summary
                  </CardTitle>
                  <CardDescription>{caseIdentitySummary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {row.redFlag?.message ? <p className="text-muted-foreground">{row.redFlag.message}</p> : null}

                  <div className="rounded-md border p-3">
                    <p className="font-medium">Documents / hashes</p>
                    <p className="text-muted-foreground">
                      Document duplicate findings: {Array.isArray(ev.documentHashFindings) ? ev.documentHashFindings.length : 0}
                    </p>
                    <p className="text-muted-foreground">
                      Image duplicate findings: {Array.isArray(ev.imageHashFindings) ? ev.imageHashFindings.length : 0}
                    </p>
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="font-medium">Identity protocols (biometric)</p>
                    <p className="text-muted-foreground">
                      {protocolA ? `Protocol A: ${protocolA.passed ? 'PASS' : 'FAIL'}` : 'Protocol A: N/A'}
                    </p>
                    <p className="text-muted-foreground">
                      {protocolB
                        ? `Protocol B: ${protocolB.passed ? 'PASS' : protocolB.skipped ? 'SKIPPED' : 'FAIL'}`
                        : 'Protocol B: N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Advisory notes
                  </CardTitle>
                  <CardDescription>
                    Arbitrators are neutral consultants. Notes here do not trigger transfers, locks, or dispute outcomes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    rows={6}
                    placeholder="Write advisory guidance for the buyer/seller/admin here (e.g. missing documents, next steps, risks)…"
                  />
                  <Button
                    variant="secondary"
                    disabled={acting}
                    onClick={() => toast.success('Saved locally for this session (prototype).')}
                  >
                    Save advisory note
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessagesSquare className="h-4 w-4" />
                    Communication logs
                  </CardTitle>
                  <CardDescription>Read-only chat logs linked to this parcel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No conversations found for this parcel.</p>
                  ) : (
                    conversations.map((cRaw: unknown) => {
                      const c = (cRaw ?? {}) as Record<string, unknown>;
                      const cid = String(c.id ?? '');
                      const msgs = Array.isArray(c.messages) ? (c.messages as unknown[]) : [];
                      return (
                      <div key={cid || JSON.stringify(c)} className="rounded-md border p-3">
                        <p className="text-xs font-mono text-muted-foreground">Conversation {cid || '—'}</p>
                        <div className="mt-2 space-y-2">
                          {msgs.slice(-30).map((mRaw: unknown, mi: number) => {
                            const m = (mRaw ?? {}) as Record<string, unknown>;
                            const mid = String(m.id ?? mi);
                            const sender = (m.sender as Record<string, unknown> | undefined) ?? undefined;
                            const senderLabel = String((sender?.name as string | undefined) ?? m.senderId ?? '—');
                            const createdAt = m.createdAt ? new Date(String(m.createdAt)).toLocaleString() : '—';
                            const text = String(m.text ?? '');
                            const attachments = Array.isArray(m.attachments) ? (m.attachments as unknown[]) : [];
                            return (
                            <div key={mid} className="text-sm">
                              <span className="font-medium">{senderLabel}</span>
                              <span className="text-muted-foreground"> · {createdAt}</span>
                              <div className="text-foreground">{text}</div>
                              {attachments.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                  {attachments.map((aRaw: unknown, idx: number) => {
                                    const a = (aRaw ?? {}) as Record<string, unknown>;
                                    const kind = String(a.kind ?? '');
                                    const dataUrl = String(a.dataUrl ?? '');
                                    const name = String(a.name ?? `attachment-${idx + 1}`);
                                    const transcript = typeof a.transcript === 'string' ? a.transcript : null;
                                    const auditHash = typeof a.auditHash === 'string' ? a.auditHash : null;
                                    return (
                                    <div key={`${mid}-att-${idx}`} className="rounded-md border p-2">
                                      {kind === 'audio' ? (
                                        <div className="space-y-2">
                                          <audio controls src={dataUrl} className="w-full" />
                                          {transcript ? (
                                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                              Transcript: {transcript}
                                            </div>
                                          ) : null}
                                          {auditHash ? (
                                            <div className="text-[10px] font-mono text-muted-foreground break-all">
                                              Hash: {auditHash}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : kind === 'image' ? (
                                        <img src={dataUrl} alt={name} className="max-h-48 w-full object-cover rounded-md border" />
                                      ) : (
                                        <a href={dataUrl} download={name} className="text-xs underline text-primary break-all">
                                          {name}
                                        </a>
                                      )}
                                    </div>
                                  );})}
                                </div>
                              ) : null}
                            </div>
                          );})}
                        </div>
                      </div>
                    );})
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ArbitrationCaseManager() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getArbitrationCases();
      const r = res as unknown as { cases?: unknown };
      const list = Array.isArray(r.cases) ? (r.cases as CaseRow[]) : [];
      setRows(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load cases');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground">Neutral Case Management</CardTitle>
        <CardDescription>Cases are listed by Parcel ID to preserve neutrality.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading cases…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active arbitration cases.</p>
        ) : (
          rows.map((r) => (
            <div key={r.parcelId} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="text-xs font-mono text-muted-foreground">{r.parcelId}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">{r.redFlag?.code ?? 'CASE'}</Badge>
                  <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                </div>
              </div>
              <EvidenceDialog row={r} onActionComplete={load} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

