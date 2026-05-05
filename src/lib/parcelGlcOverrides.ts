/**
 * Prototype: when the API cannot PATCH parcel document status yet, GLC reviewers
 * can mark parcels verified/rejected here — merged in LandRegistry on load.
 */
const KEY = 'smartland_glc_doc_verification_v1';

function readMap(): Record<string, 'pending' | 'verified' | 'rejected'> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, 'pending' | 'verified' | 'rejected'> = {};
    for (const [id, v] of Object.entries(p)) {
      if (v === 'verified' || v === 'pending' || v === 'rejected') out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, 'pending' | 'verified' | 'rejected'>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

export function getParcelDocumentVerificationOverride(
  parcelId: string
): 'pending' | 'verified' | 'rejected' | null {
  const m = readMap();
  return m[parcelId] ?? null;
}

export function setParcelDocumentVerificationOverride(
  parcelId: string,
  status: 'pending' | 'verified' | 'rejected'
) {
  const m = readMap();
  m[parcelId] = status;
  writeMap(m);
  try {
    window.dispatchEvent(new CustomEvent('smartland-parcel-glc-updated'));
  } catch {
    // ignore
  }
}

export function mergeParcelDocumentVerification(
  parcelId: string,
  fromApi: 'pending' | 'verified' | 'rejected' | undefined | null
): 'pending' | 'verified' | 'rejected' {
  const o = getParcelDocumentVerificationOverride(parcelId);
  if (o) return o;
  if (fromApi === 'verified' || fromApi === 'pending' || fromApi === 'rejected') return fromApi;
  return 'pending';
}
