export const SQM_PER_ACRE = 4046.86;
export const SQFT_PER_ACRE = 43560;
export const SQFT_PER_SQM = 10.763910416709722;

export function sqmToSqft(sqm: number) {
  return sqm * SQFT_PER_SQM;
}

export function sqftToSqm(sqft: number) {
  return sqft / SQFT_PER_SQM;
}

export function acresToSqm(acres: number) {
  return acres * SQM_PER_ACRE;
}

export function sqmToAcres(sqm: number) {
  return sqm / SQM_PER_ACRE;
}

/**
 * Parse human input into sqm.
 * Supports:
 * - "500" (assumed sqm)
 * - "5382 sqft" / "5382 sq ft"
 * - "0.12 acre" / "0.12 acres"
 * - "100x70 ft" / "100 x 70ft"
 */
export function parseAreaToSqm(input: string): { sqm: number | null; note?: string } {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return { sqm: null };

  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, ' ');

  // dimension format 100x70 ft
  const dim = cleaned.match(/^(\d+(\.\d+)?)\s*[x×]\s*(\d+(\.\d+)?)\s*(ft|feet)$/);
  if (dim) {
    const a = Number(dim[1]);
    const b = Number(dim[3]);
    const sqft = a * b;
    return { sqm: sqftToSqm(sqft), note: `${sqft.toFixed(0)} sqft` };
  }

  const num = cleaned.match(/(\d+(\.\d+)?)/);
  if (!num) return { sqm: null };
  const n = Number(num[1]);
  if (!Number.isFinite(n) || n <= 0) return { sqm: null };

  if (/(sq\s*ft|sqft|square\s*feet|ft2)/.test(cleaned)) return { sqm: sqftToSqm(n) };
  if (/(acre|acres)/.test(cleaned)) return { sqm: acresToSqm(n) };
  if (/(sqm|m2|square\s*meters|square\s*metres)/.test(cleaned)) return { sqm: n };

  // default: assume sqm
  return { sqm: n, note: 'Assumed square meters (sqm)' };
}

export function formatAreaSummary(sqm: number) {
  const acres = sqmToAcres(sqm);
  const sqft = sqmToSqft(sqm);
  return {
    sqm,
    sqft,
    acres,
    text: `≈ ${acres.toFixed(2)} acres (${sqft.toFixed(0)} sqft)`,
  };
}

