/**
 * Persists in-progress Ghana Card verification on this device so users can close the tab and resume.
 * Cleared after a successful submission (`clearGhanaCardDraft`).
 */

export type GhanaCardDraftV1 = {
  version: 1;
  updatedAt: string;
  step: 1 | 2 | 3;
  subStep: 'front' | 'back' | 'details';
  frontCard: string;
  backCard: string;
  faceImage: string;
  cardNumber: string;
  fullName: string;
  faceCaptureMethod: 'live_camera' | 'upload' | null;
  faceScreeningDone: boolean;
  faceScreeningMessage: string;
  requiresManualReview: boolean;
  faceRecognitionStep: 'extracting' | 'comparing' | 'liveness' | 'done' | null;
  faceSimilarityScore: number | null;
  smartlandProtocols: Record<string, unknown> | null;
};

const STORAGE_PREFIX = 'smartland_ghana_card_draft_v1:';

function key(userKey: string) {
  return `${STORAGE_PREFIX}${userKey}`;
}

function isDataUrl(s: string | undefined | null): boolean {
  return typeof s === 'string' && s.startsWith('data:image/');
}

export function loadGhanaCardDraft(userKey: string): GhanaCardDraftV1 | null {
  if (!userKey) return null;
  try {
    const raw = localStorage.getItem(key(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (o.version !== 1) return null;
    const step = o.step === 2 ? 2 : o.step === 3 ? 3 : 1;
    const subRaw = o.subStep;
    const subStep =
      subRaw === 'back' ? 'back' : subRaw === 'details' ? 'details' : 'front';
    const faceCaptureMethod =
      o.faceCaptureMethod === 'live_camera'
        ? 'live_camera'
        : o.faceCaptureMethod === 'upload'
          ? 'upload'
          : null;
    let faceRecognitionStep = o.faceRecognitionStep as GhanaCardDraftV1['faceRecognitionStep'];
    if (
      faceRecognitionStep !== 'extracting' &&
      faceRecognitionStep !== 'comparing' &&
      faceRecognitionStep !== 'liveness' &&
      faceRecognitionStep !== 'done'
    ) {
      faceRecognitionStep = null;
    }

    return {
      version: 1,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
      step,
      subStep,
      frontCard: typeof o.frontCard === 'string' ? o.frontCard : '',
      backCard: typeof o.backCard === 'string' ? o.backCard : '',
      faceImage: typeof o.faceImage === 'string' ? o.faceImage : '',
      cardNumber: typeof o.cardNumber === 'string' ? o.cardNumber : '',
      fullName: typeof o.fullName === 'string' ? o.fullName : '',
      faceCaptureMethod,
      faceScreeningDone: Boolean(o.faceScreeningDone),
      faceScreeningMessage: typeof o.faceScreeningMessage === 'string' ? o.faceScreeningMessage : '',
      requiresManualReview: Boolean(o.requiresManualReview),
      faceRecognitionStep,
      faceSimilarityScore: typeof o.faceSimilarityScore === 'number' ? o.faceSimilarityScore : null,
      smartlandProtocols:
        o.smartlandProtocols && typeof o.smartlandProtocols === 'object'
          ? (o.smartlandProtocols as Record<string, unknown>)
          : null,
    };
  } catch {
    return null;
  }
}

/** Best-effort persist; on quota errors drops images but keeps step/text fields. */
export function saveGhanaCardDraft(userKey: string, draft: GhanaCardDraftV1): void {
  if (!userKey) return;
  const payload = JSON.stringify(draft);
  try {
    localStorage.setItem(key(userKey), payload);
    return;
  } catch {
    // Try smaller payload without base64 blobs
  }
  try {
    const slim: GhanaCardDraftV1 = {
      ...draft,
      frontCard: '',
      backCard: '',
      faceImage: '',
      step:
        draft.step === 3 || (draft.step === 2 && (!isDataUrl(draft.faceImage) || !draft.faceScreeningDone))
          ? 2
          : draft.step === 2
            ? 2
            : 1,
      subStep: draft.subStep,
    };
    localStorage.setItem(key(userKey), JSON.stringify(slim));
  } catch {
    // ignore private mode / quota
  }
}

export function clearGhanaCardDraft(userKey: string): void {
  if (!userKey) return;
  try {
    localStorage.removeItem(key(userKey));
  } catch {
    // ignore
  }
}

/** Remove any saved draft whose `fullName` contains `fragment` (case-insensitive). */
export function clearGhanaCardDraftsByFullNameContains(fragment: string): number {
  const f = fragment.trim().toLowerCase();
  if (f.length < 2) return 0;
  let cleared = 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const o = JSON.parse(raw) as { fullName?: string };
        if (typeof o.fullName === 'string' && o.fullName.toLowerCase().includes(f)) {
          localStorage.removeItem(k);
          cleared++;
        }
      } catch {
        // ignore malformed
      }
    }
  } catch {
    // ignore
  }
  return cleared;
}

/**
 * Same rule as pending-user purge: every whitespace token (length ≥ 2) from `fullNamePattern`
 * must appear in the draft’s `fullName` (case-insensitive). Catches “Wuni Sumnima” vs “Wuni Sumnima Ghana”.
 */
export function clearGhanaCardDraftsByAllNameTokens(fullNamePattern: string): number {
  const tokens = fullNamePattern
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length < 2) return 0;
  let cleared = 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const o = JSON.parse(raw) as { fullName?: string };
        const fn = typeof o.fullName === 'string' ? o.fullName.trim().toLowerCase() : '';
        if (tokens.every((t) => fn.includes(t))) {
          localStorage.removeItem(k);
          cleared++;
        }
      } catch {
        // ignore malformed
      }
    }
  } catch {
    // ignore
  }
  return cleared;
}
