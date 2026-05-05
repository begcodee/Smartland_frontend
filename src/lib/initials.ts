export function getInitials(name: string | null | undefined): string {
  const n = String(name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const out = (a + b).toUpperCase();
  return out || '?';
}

