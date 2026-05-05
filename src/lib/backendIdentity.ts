export function readBackendIdentityStatus(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  return (u.identityStatus as string | null | undefined) ?? (u.niaStatus as string | null | undefined) ?? null;
}

export function readBackendIdentityReferenceId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  return (u.identityReferenceId as string | undefined) ?? (u.niaReferenceId as string | undefined) ?? undefined;
}

