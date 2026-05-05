/** Parse SmartLand API error bodies (message, error, Zod details.fieldErrors). */

export async function readJsonResponse(r: Response): Promise<unknown> {
  const text = await r.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 240) || `HTTP ${r.status}` };
  }
}

export function errorMessageFromApiBody(data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();

  const details = o.details;
  if (details && typeof details === 'object') {
    const d = details as Record<string, unknown>;
    const fe = d.fieldErrors;
    if (fe && typeof fe === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(fe as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length) parts.push(`${k}: ${v.map(String).join(', ')}`);
      }
      if (parts.length) return parts.join('; ');
    }
    const formErrors = d.formErrors;
    if (Array.isArray(formErrors) && formErrors.length) {
      return formErrors.map(String).join('; ');
    }
  }
  return undefined;
}
