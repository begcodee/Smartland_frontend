import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, MessageCircle, PhoneCall, ShieldCheck, Gavel, UserRound, ExternalLink, Paperclip, Camera, X, LayoutGrid, Mic, Square } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getInitials } from '@/lib/initials';

type Attachment =
  | { kind: 'image' | 'document'; name: string; mimeType: string; dataUrl: string }
  | {
      kind: 'audio';
      name: string;
      mimeType: string;
      dataUrl: string;
      transcript?: string;
      transcriptImmutable?: boolean;
      auditHash?: string;
      keywordFlags?: string[];
    };
type Msg = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender?: { id: string; name: string };
  attachments?: Attachment[];
};

interface ParcelChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landParcelId: string;
  parcelTitle: string;
}

export function ParcelChatDialog({ open, onOpenChange, landParcelId, parcelTitle }: ParcelChatDialogProps) {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{
    buyer?: { id: string; name: string; phoneNumber?: string };
    seller?: { id: string; name: string; phoneNumber?: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [otherParcels, setOtherParcels] = useState<Array<{ id: string; title: string; priceGhs?: number; status?: string }>>([]);
  const [otherParcelsLoading, setOtherParcelsLoading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: unknown) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop?: () => void;
  };
  type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingChannelRef = useRef<BroadcastChannel | null>(null);

  const myId = user?.id ?? '';
  const verifiedForAudio = user?.identityStatus === 'verified';

  const canUse = useMemo(() => Boolean(open && landParcelId && myId), [open, landParcelId, myId]);

  const load = async (cid: string) => {
    const res = await api.getConversationMessages(cid);
    setMessages(res.messages);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const addAttachmentsFromFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const next: Attachment[] = [];
    for (const f of list) {
      if (draftAttachments.length + next.length >= 5) break;
      // 2MB guard (demo)
      if (f.size > 2_000_000) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('Failed to read file'));
        r.readAsDataURL(f);
      });
      const kind = f.type.startsWith('image/') ? 'image' : 'document';
      next.push({ kind, name: f.name, mimeType: f.type || 'application/octet-stream', dataUrl });
    }
    if (next.length) setDraftAttachments((prev) => [...prev, ...next]);
  };

  const stopSpeech = () => {
    try {
      if (speechRef.current) {
        speechRef.current.onresult = null;
        speechRef.current.onerror = null;
        speechRef.current.onend = null;
        speechRef.current.stop?.();
      }
    } catch {
      // ignore
    } finally {
      speechRef.current = null;
    }
  };

  const startSpeech = () => {
    setSpeechTranscript('');
    try {
      const w = window as unknown as Window & {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
      };
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (event: unknown) => {
        const e = event as {
          resultIndex?: number;
          results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
        };
        const start = typeof e.resultIndex === 'number' ? e.resultIndex : 0;
        const results = e.results;
        if (!results || typeof results.length !== 'number') return;
        let txt = '';
        for (let i = start; i < results.length; i++) {
          txt += String(results[i]?.[0]?.transcript || '');
        }
        if (txt.trim()) setSpeechTranscript((prev) => (prev ? (prev + ' ' + txt).trim() : txt.trim()));
      };
      rec.onerror = () => {};
      rec.onend = () => {};
      speechRef.current = rec;
      rec.start();
    } catch {
      // ignore
    }
  };

  const startRecording = async () => {
    if (!verifiedForAudio) return;
    if (draftAttachments.length >= 5) return;
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      micChunksRef.current = [];

      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) micChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        try {
          const blob = new Blob(micChunksRef.current, { type: mr.mimeType || 'audio/webm' });
          // Keep demo-safe size (~2MB). Longer notes can be enabled later.
          if (blob.size > 2_000_000) {
            setSpeechTranscript('');
            return;
          }
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => reject(new Error('Failed to read audio'));
            r.readAsDataURL(blob);
          });

          const stamp = Date.now();
          const senderInitials = getInitials(user?.name);
          const name = `${landParcelId}_${stamp}_${senderInitials}.webm`;
          const transcript = speechTranscript.trim() || undefined;

          setDraftAttachments((prev) => [
            ...prev.slice(0, 4),
            { kind: 'audio', name, mimeType: blob.type || 'audio/webm', dataUrl, transcript }
          ]);
        } finally {
          setSpeechTranscript('');
        }
      };

      setRecording(true);
      startSpeech();
      mr.start(250);
    } catch {
      // ignore
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    try {
      stopSpeech();
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    } finally {
      setRecording(false);
      mediaRecorderRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  const stopCamera = () => {
    camStream?.getTracks().forEach((t) => t.stop());
    setCamStream(null);
  };

  const startCamera = async () => {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    setCamStream(stream);
    setCamOpen(true);
    setTimeout(() => {
      if (camVideoRef.current) {
        camVideoRef.current.srcObject = stream;
      }
    }, 50);
  };

  const capturePhoto = () => {
    const v = camVideoRef.current;
    const c = camCanvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    setDraftAttachments((prev) => [
      ...prev.slice(0, 4),
      { kind: 'image', name: `photo-${Date.now()}.jpg`, mimeType: 'image/jpeg', dataUrl }
    ]);
    setCamOpen(false);
    stopCamera();
  };

  useEffect(() => {
    if (!canUse) return;
    let stop = false;
    setLoading(true);
    (async () => {
      try {
        const started = await api.startConversation(landParcelId);
        if (stop) return;
        const cid = started.conversation.id;
        setConversationId(cid);
        setParticipants({
          buyer: started.conversation.buyer,
          seller: started.conversation.seller
        });
        await load(cid);
      } catch {
        setConversationId(null);
        setParticipants(null);
        setMessages([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [canUse, landParcelId]);

  const otherParty = useMemo(() => {
    if (!participants || !myId) return null;
    const b = participants.buyer;
    const s = participants.seller;
    if (b?.id === myId) return s ? { ...s, label: 'Seller' } : null;
    if (s?.id === myId) return b ? { ...b, label: 'Buyer' } : null;
    return null;
  }, [participants, myId]);

  const tel = (n?: string) => (n ? `tel:${n.replace(/[^\d+]/g, '')}` : '');

  const landsCommissionPhone = process.env.NEXT_PUBLIC_LANDS_COMMISSION_PHONE ?? '';
  const arbitratorPhone = process.env.NEXT_PUBLIC_ARBITRATOR_PHONE ?? '';

  // Poll while dialog open (simple + reliable)
  useEffect(() => {
    if (!open || !conversationId) return;
    const t = window.setInterval(() => {
      void load(conversationId).catch(() => {});
    }, 3500);
    return () => window.clearInterval(t);
  }, [open, conversationId]);

  // Typing indicator (lightweight, cross-tab on same device)
  useEffect(() => {
    if (!conversationId) return;
    const ch = new BroadcastChannel('smartland_typing');
    typingChannelRef.current = ch;
    const handler = (ev: MessageEvent) => {
      const data = ev.data as { conversationId?: string; from?: string; typing?: boolean; expiresAt?: number } | null;
      if (!data || data.conversationId !== conversationId) return;
      if (!data.from || data.from === myId) return;
      if (data.typing && data.expiresAt && data.expiresAt > Date.now()) {
        setOtherTyping(true);
        window.setTimeout(() => setOtherTyping(false), Math.min(2500, data.expiresAt - Date.now()));
      } else {
        setOtherTyping(false);
      }
    };
    ch.addEventListener('message', handler);
    return () => {
      ch.removeEventListener('message', handler);
      ch.close();
      typingChannelRef.current = null;
    };
  }, [conversationId, myId]);

  const publishTyping = (typing: boolean) => {
    if (!conversationId) return;
    try {
      typingChannelRef.current?.postMessage({
        conversationId,
        from: myId,
        typing,
        expiresAt: typing ? Date.now() + 2200 : Date.now(),
      });
    } catch {
      // ignore
    }
  };

  const otherInitials = useMemo(() => getInitials(otherParty?.name), [otherParty?.name]);

  useEffect(() => {
    if (!profileOpen || !otherParty) return;
    setOtherParcelsLoading(true);
    (async () => {
      try {
        const parcels = await api.getParcels();
        const list = Array.isArray(parcels) ? parcels : (parcels?.parcels ?? []);
        const mapped = (Array.isArray(list) ? list : [])
          .filter((p: unknown) => {
            const o = (p ?? {}) as Record<string, unknown>;
            // Try to support both backend shapes
            const sellerId =
              (o.sellerId as string | undefined) ||
              ((o.seller as Record<string, unknown> | undefined)?.id as string | undefined) ||
              (o.ownerId as string | undefined) ||
              ((o.owner as Record<string, unknown> | undefined)?.id as string | undefined);
            const status = String(o.status ?? '').toLowerCase();
            return sellerId === otherParty.id && (status === 'available' || status === ''); // default to show
          })
          .map((p: unknown) => {
            const o = (p ?? {}) as Record<string, unknown>;
            const id = String(o.id ?? '');
            const title = String(o.title ?? o.land_name ?? o.name ?? 'Parcel');
            const priceGhs =
              typeof o.priceGhs === 'number'
                ? o.priceGhs
                : typeof o.price === 'number'
                  ? o.price
                  : undefined;
            const status = typeof o.status === 'string' ? o.status : undefined;
            return { id, title, priceGhs, status };
          });
        setOtherParcels(mapped);
      } catch {
        setOtherParcels([]);
      } finally {
        setOtherParcelsLoading(false);
      }
    })();
  }, [profileOpen, otherParty?.id]);

  const send = async () => {
    const body = draft.trim();
    if (!body && draftAttachments.length === 0) return;
    setSending(true);
    try {
      if (!conversationId) return;
      await api.sendConversationMessage(conversationId, body, draftAttachments);
      setDraft('');
      setDraftAttachments([]);
      await load(conversationId);
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => {
    const out: Array<{ kind: 'day' | 'msg'; day?: string; msg?: Msg }> = [];
    let lastDay = '';
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const day = d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      if (day !== lastDay) {
        out.push({ kind: 'day', day });
        lastDay = day;
      }
      out.push({ kind: 'msg', msg: m });
    }
    return out;
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MessageCircle className="h-5 w-5 text-primary" />
            {otherParty ? `Chat with ${otherParty.name}` : 'Chat'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {otherParty ? (
              <span className="inline-flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{otherParty.label}</Badge>
                <span className="text-xs">
                  Parcel: <span className="font-medium text-foreground">{parcelTitle}</span>
                </span>
              </span>
            ) : (
              <span>
                Parcel: <span className="font-medium text-foreground">{parcelTitle}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 border border-border flex items-center justify-center text-sm font-semibold text-primary">
              {otherInitials}
            </div>
            <div className="min-w-0">
              {otherParty ? (
                <div className="flex items-center gap-2">
                  <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-foreground font-semibold">
                        <UserRound className="h-4 w-4 mr-2 text-primary" />
                        <span className="truncate max-w-[220px]">{otherParty.name}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl bg-card border-border">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <UserRound className="h-5 w-5 text-primary" />
                          {otherParty.name}
                        </DialogTitle>
                        <DialogDescription>
                          Profile and available parcels
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{otherParty.label}</Badge>
                          {otherParty.phoneNumber ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={tel(otherParty.phoneNumber)}>
                                <PhoneCall className="h-4 w-4 mr-2" />
                                Call
                              </a>
                            </Button>
                          ) : null}
                        </div>

                        {otherParty.label === 'Seller' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">Available parcels</p>
                              <Badge variant="outline" className="text-xs">
                                {otherParcelsLoading ? 'Loading…' : `${otherParcels.length}`}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {otherParcelsLoading ? (
                                <div className="text-sm text-muted-foreground">Loading parcels…</div>
                              ) : otherParcels.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No available parcels found.</div>
                              ) : (
                                otherParcels.slice(0, 6).map((p) => (
                                  <Card key={p.id} className="p-3 border border-border bg-card">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                                        <p className="text-xs text-muted-foreground">Status: {p.status ?? 'available'}</p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => {
                                          // deep-link to open the exact parcel automatically
                                          window.location.href = `/buyer?parcelId=${encodeURIComponent(p.id)}`;
                                        }}
                                      >
                                        View <ExternalLink className="h-3.5 w-3.5 ml-2" />
                                      </Button>
                                    </div>
                                  </Card>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Badge variant="outline" className="text-xs capitalize">{otherParty.label}</Badge>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Participants</p>
              )}
              <p className="text-[11px] text-muted-foreground">Messages are tied to this parcel</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {otherParty?.phoneNumber && (
              <Button asChild variant="outline" size="sm">
                <a href={tel(otherParty.phoneNumber)}>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call {otherParty.label.toLowerCase()}
                </a>
              </Button>
            )}
            {landsCommissionPhone && (
              <Button asChild variant="secondary" size="sm">
                <a href={tel(landsCommissionPhone)}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Call Lands Commission
                </a>
              </Button>
            )}
            {arbitratorPhone && (
              <Button asChild variant="secondary" size="sm">
                <a href={tel(arbitratorPhone)}>
                  <Gavel className="h-4 w-4 mr-2" />
                  Call Arbitrator
                </a>
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading conversation…
          </div>
        ) : (
          <>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-3">
                    {grouped.map((g, idx) => {
                      if (g.kind === 'day') {
                        return (
                          <div key={`day-${idx}`} className="flex justify-center">
                            <Badge variant="outline" className="text-xs">
                              {g.day}
                            </Badge>
                          </div>
                        );
                      }
                      const m = g.msg!;
                      const mine = m.senderId === myId;
                      const time = new Date(m.createdAt);
                      const stamp = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm border shadow-sm ${
                              mine
                                ? 'bg-primary text-primary-foreground border-primary/20'
                                : 'bg-card text-foreground border-border'
                            }`}
                          >
                            {m.body ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}
                            {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {m.attachments.map((a, aidx) => (
                                  <div key={`${m.id}-att-${aidx}`} className="rounded-lg border border-border bg-background/40 p-2">
                                    {a.kind === 'image' ? (
                                      <img src={a.dataUrl} alt={a.name} className="max-h-48 w-full object-cover rounded-md border border-border" />
                                    ) : a.kind === 'audio' ? (
                                      <div className="space-y-2">
                                        <audio controls src={a.dataUrl} className="w-full" />
                                        {a.transcript ? (
                                          <details className="text-xs">
                                            <summary className="cursor-pointer underline text-primary">Read transcript</summary>
                                            <div className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                                              {a.transcript}
                                            </div>
                                            {Array.isArray(a.keywordFlags) && a.keywordFlags.length > 0 ? (
                                              <div className="mt-2">
                                                <Badge variant="destructive" className="text-[10px]">
                                                  Watchdog terms: {a.keywordFlags.join(', ')}
                                                </Badge>
                                              </div>
                                            ) : null}
                                          </details>
                                        ) : (
                                          <p className="text-[11px] text-muted-foreground">Transcript pending/unavailable on this device.</p>
                                        )}
                                        {a.auditHash ? (
                                          <p className="text-[10px] font-mono text-muted-foreground break-all">
                                            Hash: {a.auditHash}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <a
                                        href={a.dataUrl}
                                        download={a.name}
                                        className="text-xs underline text-primary break-all"
                                      >
                                        {a.name}
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {stamp}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {otherTyping && (
                      <div className="flex justify-start">
                        <div className="max-w-[78%] rounded-2xl px-4 py-2 text-sm border bg-card text-muted-foreground border-border">
                          typing…
                        </div>
                      </div>
                    )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {draftAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draftAttachments.map((a, idx) => (
                  <Badge key={`${a.name}-${idx}`} variant="secondary" className="gap-2">
                    <span className="max-w-[220px] truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setDraftAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="opacity-80 hover:opacity-100"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,application/pdf,.pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files) void addAttachmentsFromFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={draftAttachments.length >= 5}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void startCamera()}
                disabled={draftAttachments.length >= 5}
              >
                <Camera className="h-4 w-4" />
              </Button>
              {verifiedForAudio ? (
                <Button
                  type="button"
                  variant={recording ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => (recording ? stopRecording() : void startRecording())}
                  disabled={draftAttachments.length >= 5}
                  title={recording ? 'Stop recording' : 'Record voice note'}
                >
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              ) : null}
              {otherParty?.label === 'Seller' && (
                <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Catalog</DialogTitle>
                      <DialogDescription>
                        {otherParty.name}&apos;s available parcels
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[420px] pr-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">Available parcels</p>
                          <Badge variant="outline" className="text-xs">
                            {otherParcelsLoading ? 'Loading…' : `${otherParcels.length}`}
                          </Badge>
                        </div>
                        {otherParcelsLoading ? (
                          <div className="text-sm text-muted-foreground">Loading parcels…</div>
                        ) : otherParcels.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No available parcels found.</div>
                        ) : (
                          otherParcels.map((p) => (
                            <Card key={p.id} className="p-3 border border-border bg-card">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                                  <p className="text-xs text-muted-foreground">Status: {p.status ?? 'available'}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => {
                                    window.location.href = `/buyer?parcelId=${encodeURIComponent(p.id)}`;
                                  }}
                                >
                                  View <ExternalLink className="h-3.5 w-3.5 ml-2" />
                                </Button>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}

              <Input
                value={draft}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft(v);
                  publishTyping(Boolean(v.trim()));
                  if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = window.setTimeout(() => publishTyping(false), 1600);
                }}
                placeholder="Type a message…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button onClick={() => void send()} disabled={sending || (!draft.trim() && draftAttachments.length === 0)}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </Button>
            </div>

            {camOpen && (
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Camera</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCamOpen(false);
                      stopCamera();
                    }}
                  >
                    Close
                  </Button>
                </div>
                <video ref={camVideoRef} autoPlay playsInline muted className="w-full max-h-64 rounded-lg bg-black border border-border" />
                <canvas ref={camCanvasRef} className="hidden" />
                <Button type="button" className="w-full" onClick={capturePhoto}>
                  Capture photo
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

