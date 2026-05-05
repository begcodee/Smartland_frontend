/**
 * Ghana Card (National ID) number criteria.
 * Card number is typically GHA-XXXXXXXXX-X (9 digits + check digit).
 */

export function normalizeGhanaCardNumber(input: string): string {
  return input.trim().replace(/\s+/g, '').toUpperCase();
}

/** Strict format: GHA- followed by 9 digits, hyphen, single digit (check). */
export function isValidGhanaCardFormat(normalized: string): boolean {
  return /^GHA-\d{9}-\d$/.test(normalized);
}

export const GHANA_CARD_FORMAT_HINT =
  'Ghana Card number must look like GHA-123456789-1 (GHA, nine digits, a hyphen, then one digit).';

export function validateFullNameAsOnCard(name: string): boolean {
  const t = name.trim();
  return t.length >= 3 && /\s/.test(t);
}
