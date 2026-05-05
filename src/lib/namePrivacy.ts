/** Privacy utilities: show initials instead of full names where required. */

export function initialsFromName(name: string | null | undefined): string {
  const n = String(name ?? '').trim();
  if (!n) return '';
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') ?? '';
  const initials = (first + last).toUpperCase();
  // If single-word name, return first 2 letters (e.g. "Kofi" -> "KO")
  if (!last) return n.slice(0, 2).toUpperCase();
  return initials;
}

