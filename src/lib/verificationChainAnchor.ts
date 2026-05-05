const DECISION_TX_KEYS = [
  // Legacy keys that may still be returned by the backend.
  'niaAttestationTxHash',
  'niaRejectionTxHash',
  'chainAnchorTxHash',
  'transactionHash',
  'txHash',
] as const;

function pickTxHash(obj: Record<string, unknown> | undefined | null): string | undefined {
  if (!obj) return undefined;
  for (const k of DECISION_TX_KEYS) {
    const v = obj[k];
    if (typeof v === 'string' && /^0x[a-fA-F0-9]{8,128}$/.test(v)) return v;
  }
  return undefined;
}

/** Reads a chain tx hash from a verification decision payload (top-level or nested `user`). */
export function extractVerificationDecisionChainTx(
  data: Record<string, unknown> | undefined
): string | undefined {
  if (!data) return undefined;
  return pickTxHash(data) ?? pickTxHash(data.user as Record<string, unknown> | undefined);
}

/** Prototype-only anchor when the API does not yet return a real transaction hash. */
export function prototypeVerificationDecisionTxHash(): string {
  return `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
}

export function shortTxHash(full: string, lead = 12, tail = 10): string {
  if (full.length <= lead + tail + 3) return full;
  return `${full.slice(0, lead)}…${full.slice(-tail)}`;
}
