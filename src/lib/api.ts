/**
 * SmartLand API client — connects frontend to backend
 */

import { API_BASE, healthCheckUrl } from './apiBase';
import { errorMessageFromApiBody, readJsonResponse } from './apiErrors';

function getToken(): string | null {
  return localStorage.getItem('smartland_token');
}

function headers(includeAuth = true): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (includeAuth && token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchBlob(url: string): Promise<Blob> {
  const token = getToken();
  const r = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(txt || `Download failed (${r.status})`);
  }
  return await r.blob();
}

export type LawCategory = 'registration' | 'transfer' | 'dispute' | 'environmental' | 'general';
export type LawStatus = 'draft' | 'active';

export type LawRecord = {
  id: string;
  code: string;
  title: string;
  summary: string;
  body: string;
  category: LawCategory;
  effectiveFrom: string;
  status: LawStatus;
  createdAt: string;
  updatedAt: string;
};

export type LawPayload = {
  code?: string;
  title: string;
  summary?: string;
  body?: string;
  category?: LawCategory;
  effectiveFrom?: string;
  status?: LawStatus;
};

export const api = {
  async health() {
    const r = await fetch(healthCheckUrl());
    return r.json();
  },

  /** Register a new user directly — creates account with verificationStatus: pending */
  async register(payload: {
    name: string;
    email: string;
    phoneNumber: string;
    role: string;
    organization?: string;
    password: string;
    staffId?: string;
    arbitratorRegNo?: string;
  }) {
    const r = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: headers(false),
      body: JSON.stringify(payload)
    });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Registration failed (${r.status})`);
    }
    const data = dataRaw as Record<string, unknown>;
    if (typeof data.token === 'string') localStorage.setItem('smartland_token', data.token);
    return data;
  },

  async login(email: string, password: string, role?: string, staffId?: string, arbitratorRegNo?: string) {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: headers(false),
      body: JSON.stringify({ email, password, role, staffId, arbitratorRegNo })
    });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Login failed (${r.status})`);
    }
    const data = dataRaw as Record<string, unknown>;
    if (typeof data.token === 'string') localStorage.setItem('smartland_token', data.token);
    return data;
  },

  async me() {
    const r = await fetch(`${API_BASE}/auth/me`, { method: 'GET', headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  logout() {
    localStorage.removeItem('smartland_token');
  },

  async submitRegistration(payload: {
    name: string;
    email: string;
    phoneNumber: string;
    role: string;
    organization?: string;
    password: string;
    staffId?: string;
    arbitratorRegNo?: string;
    ghanaCard: { frontCardImage: string; backCardImage: string; faceImage: string; cardNumber: string; fullName: string };
    landDocuments: Array<{ id?: string; name: string; type: string; scannedImage: string; size?: number }>;
  }) {
    const r = await fetch(`${API_BASE}/registrations/submit`, {
      method: 'POST',
      headers: headers(false),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Submission failed');
    return data;
  },

  async simulateReview(id: string) {
    const r = await fetch(`${API_BASE}/registrations/${id}/simulate-review`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.reason || 'Verification failed');
    return data;
  },

  async getPendingRegistrations() {
    const r = await fetch(`${API_BASE}/registrations/pending`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async reviewRegistration(id: string, action: 'approve' | 'reject', rejectionReason?: string) {
    const r = await fetch(`${API_BASE}/registrations/${id}/review`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action, rejectionReason })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Review failed');
    return data;
  },

  async verifyGhanaCard(payload: {
    cardNumber: string;
    fullName: string;
    frontCardImage: string;
    backCardImage: string;
    faceImage: string;
    selfieSource?: 'live_camera' | 'upload';
  }) {
    const r = await fetch(`${API_BASE}/verify/ghana-card`, {
      method: 'POST',
      headers: headers(false),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Verification failed');
    return data as {
      success: boolean;
      verified?: boolean;
      message?: string;
      pendingManualReview?: boolean;
      preScreeningPassed?: boolean;
      referenceId?: string;
      flaggedForArbitrator?: boolean;
      biometricMismatch?: boolean;
      thesisNotes?: Record<string, string>;
      protocolA?: { passed?: boolean; flags?: string[]; thesisNote?: string };
      protocolB?: {
        passed?: boolean | null;
        skipped?: boolean;
        similarity?: number | null;
        threshold?: number;
        flags?: string[];
        thesisNote?: string;
      };
      securityReport?: string[];
      smartlandProtocols?: Record<string, unknown>;
    };
  },

  async getVerificationDashboardRules() {
    const r = await fetch(`${API_BASE}/verify/dashboard-rules`, { headers: headers(false) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as { success: boolean; rules: Record<string, unknown>; thesis?: string };
  },

  /** Persist Ghana Card submission; every buyer and seller needs Lands Commission approval. */
  async saveIdVerification(idVerification: Record<string, unknown>) {
    let r: Response;
    try {
      r = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ idVerification })
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
        throw new Error(
          'Cannot reach the SmartLand API. Start the backend (port 3001), then retry. If you use a custom URL, set NEXT_PUBLIC_API_URL.'
        );
      }
      throw e;
    }
    const ct = r.headers.get('content-type') || '';
    let data: Record<string, unknown> = {};
    if (ct.includes('application/json')) {
      try {
        data = (await r.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }
    if (!r.ok) {
      const errMsg =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        `Request failed (${r.status})`;
      throw new Error(errMsg);
    }
    return data;
  },

  async getParcels(params?: { status?: string }) {
    const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    const r = await fetch(`${API_BASE}/parcels${q}`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    const parcels = Array.isArray(data) ? data : Array.isArray(data?.parcels) ? data.parcels : [];
    return { success: true as const, parcels };
  },

  /** Arbitrator/admin: restore parcel to **clear** after investigation (enables automated settlement again). */
  async clearParcelRedFlag(parcelId: string) {
    const r = await fetch(`${API_BASE}/parcels/${encodeURIComponent(parcelId)}/clear-red-flag`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to clear flag');
    return data;
  },

  async createParcel(payload: object) {
    const r = await fetch(`${API_BASE}/parcels`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  // ---- Secure file vault ----
  async uploadFile(payload: { dataUrl: string; filename?: string; scope: 'identity_verification' | 'parcel_docs' | 'glc_registry'; parcelId?: string }) {
    const scopeForApi = payload.scope === 'identity_verification' ? 'nia_identity' : payload.scope;
    const r = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...payload, scope: scopeForApi }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Upload failed');
    return data as {
      success: boolean;
      file: { id: string; sha256: string; mimeType?: string; bytesSize?: number; filename?: string; scope: string; parcelId?: string };
    };
  },

  async getFileToken(fileId: string) {
    const r = await fetch(`${API_BASE}/files/${encodeURIComponent(fileId)}/token`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Token request failed');
    return data as { success: boolean; token: string; expiresInSeconds: number };
  },

  async downloadFileByToken(token: string) {
    // Must be fetched with Authorization header; we return a Blob for UI to open.
    const url = `${API_BASE}/files/download/${encodeURIComponent(token)}`;
    return await fetchBlob(url);
  },

  async getTransfers() {
    const r = await fetch(`${API_BASE}/transfers`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async createTransfer(payload: { landParcelId: string; toUserId: string; amount: number; escrowAmount?: number }) {
    const r = await fetch(`${API_BASE}/transfers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async completeTransfer(id: string) {
    const r = await fetch(`${API_BASE}/transfers/${id}/complete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  /** Paystack checkout — Mobile Money or bank; returns authorization URL to redirect the buyer */
  async initializeLandPayment(payload: {
    landParcelId: string;
    channel: 'mobile_money' | 'bank';
    /** Demo fallback when backend DB is offline */
    amountGhs?: number;
  }) {
    const r = await fetch(`${API_BASE}/payments/initialize`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) {
      const err = new Error(data.message || 'Failed to start payment') as Error & {
        redFlag?: boolean;
        conflict?: unknown;
      };
      err.redFlag = data.redFlag === true;
      err.conflict = data.conflict;
      throw err;
    }
    return data as {
      success: boolean;
      authorizationUrl: string;
      reference: string;
      accessCode: string;
    };
  },

  /** Confirm payment after Paystack redirect (server verifies with Paystack and completes sale) */
  async verifyLandPayment(reference: string) {
    const q = new URLSearchParams({ reference });
    const r = await fetch(`${API_BASE}/payments/verify?${q}`, {
      method: 'GET',
      headers: headers()
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Verification failed');
    return data as {
      success: boolean;
      status: string;
      message?: string;
      redFlag?: boolean;
      blocked?: boolean;
      evaluation?: unknown;
      payment?: unknown;
      transfer?: {
        id: string;
        parcelId: string;
        sellerId: string;
        buyerId: string;
        paystackReference: string;
      } | null;
    };
  },

  /** Community rating (Uber-style): 1–5 stars for a completed transaction */
  async createRating(payload: { toUserId: string; stars: number; transferId: string }) {
    const r = await fetch(`${API_BASE}/ratings`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        toUserId: payload.toUserId,
        stars: payload.stars,
        context: { type: 'transfer', transferId: payload.transferId }
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error || 'Failed to submit rating');
    return data as { success: boolean; summary?: { count: number; avgStars: number; score100: number } };
  },

  async listConversations() {
    const r = await fetch(`${API_BASE}/conversations`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as { success: boolean; conversations: unknown[] };
  },

  async startConversation(landParcelId: string) {
    const r = await fetch(`${API_BASE}/conversations/start`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ landParcelId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as {
      success: boolean;
      conversation: {
        id: string;
        landParcel?: { id: string; title: string };
        buyer?: { id: string; name: string; phoneNumber?: string; email?: string };
        seller?: { id: string; name: string; phoneNumber?: string; email?: string };
      };
    };
  },

  async getConversation(conversationId: string) {
    const r = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: 'GET',
      headers: headers()
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as {
      success: boolean;
      conversation: {
        id: string;
        landParcel?: { id: string; title: string };
        buyer?: { id: string; name: string; phoneNumber?: string; email?: string };
        seller?: { id: string; name: string; phoneNumber?: string; email?: string };
      };
    };
  },

  async getConversationMessages(conversationId: string) {
    const r = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers: headers()
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as {
      success: boolean;
      messages: Array<{
        id: string;
        body: string;
        createdAt: string;
        senderId: string;
        sender?: { id: string; name: string };
        attachments?: Array<{
          kind: 'image' | 'document' | 'audio';
          name: string;
          mimeType: string;
          dataUrl: string;
          transcript?: string;
          transcriptImmutable?: boolean;
          auditHash?: string;
          keywordFlags?: string[];
        }>;
      }>;
    };
  },

  async sendConversationMessage(
    conversationId: string,
    body: string,
    attachments?: Array<{
      kind: 'image' | 'document' | 'audio';
      name: string;
      mimeType: string;
      dataUrl: string;
      transcript?: string;
    }>
  ) {
    const r = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body, attachments })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as { success: boolean; message: unknown };
  },

  /** Legacy demo slice only — omits many real accounts. Prefer {@link api.getUsers} for the full registry. */
  async landsCommissionListUsers() {
    const r = await fetch(`${API_BASE}/nia/users`, { headers: headers() });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Failed (${r.status})`);
    }
    return dataRaw as { success: boolean; users: Array<Record<string, unknown>> };
  },

  /**
   * Lands Commission: verify/reject user after database check (`reason` when rejecting).
   * Backend may anchor the decision on-chain and return one of:
   * `transactionHash` | `chainAnchorTxHash` | `txHash` (top-level or on `user`).
   */
  async landsCommissionDecision(userId: string, action: 'verify' | 'reject', reason?: string) {
    const body: { action: string; reason?: string } = { action };
    if (action === 'reject' && reason?.trim()) body.reason = reason.trim();
    const r = await fetch(`${API_BASE}/nia/users/${userId}/decision`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Decision failed (${r.status})`);
    }
    return dataRaw as {
      success: boolean;
      user?: Record<string, unknown>;
      transactionHash?: string;
      chainAnchorTxHash?: string;
      txHash?: string;
    };
  },

  /** Lands Commission: demo employee verification flow (Step 1–5) */
  async landsCommissionVerifyEmployee(input: {
    staffId: string;
    ghanaCardNumber: string;
    fullNameOnCard?: string;
    biometricSample?: string;
  }) {
    const r = await fetch(`${API_BASE}/nia/employees/verify-employee`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(input)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data as { success: boolean; decision: string; attempt: { flaggedReason?: string } };
  },

  async getParcel(id: string) {
    const r = await fetch(`${API_BASE}/parcels/${id}`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async getAnalytics() {
    const r = await fetch(`${API_BASE}/analytics`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async getUsers() {
    const r = await fetch(`${API_BASE}/users`, { headers: headers() });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Failed to load users (${r.status})`);
    }
    return dataRaw as { success: boolean; users: Array<Record<string, unknown>> };
  },

  /** Remove a user record (requires backend support for `DELETE /users/:id`). */
  async deleteUser(userId: string) {
    const r = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const dataRaw = await readJsonResponse(r);
    if (!r.ok) {
      throw new Error(errorMessageFromApiBody(dataRaw) || `Delete user failed (${r.status})`);
    }
    return dataRaw;
  },

  /** Admin: fetch users with verificationStatus = pending */
  async getPendingUsers() {
    const r = await fetch(`${API_BASE}/users/pending`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  /** Admin: approve or reject a pending user */
  async verifyUser(userId: string, action: 'approve' | 'reject', rejectionReason?: string) {
    const r = await fetch(`${API_BASE}/users/${userId}/verify`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ action, rejectionReason })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Verification action failed');
    return data;
  },

  // Note: demo helpers removed in backend-only mode.

  async getNotifications() {
    const r = await fetch(`${API_BASE}/notifications`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async markNotificationRead(id: string) {
    const r = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async patchDisputeStatus(disputeId: string, status: string) {
    const r = await fetch(`${API_BASE}/disputes/${disputeId}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async getDisputes() {
    const r = await fetch(`${API_BASE}/disputes`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async createDispute(payload: { landParcelId: string; defendantUserId: string; description: string; evidence?: string[] }) {
    const r = await fetch(`${API_BASE}/disputes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async voteDispute(disputeId: string, vote: 'support' | 'against' | 'abstain') {
    const r = await fetch(`${API_BASE}/disputes/${disputeId}/vote`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ vote })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async resolveDispute(disputeId: string, resolution: string) {
    const r = await fetch(`${API_BASE}/disputes/${disputeId}/resolve`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ resolution })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Failed');
    return data;
  },

  async getLaws() {
    const r = await fetch(`${API_BASE}/laws`, { headers: headers(false) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to load laws');
    return data as { laws: LawRecord[] };
  },

  async createLaw(payload: LawPayload) {
    const r = await fetch(`${API_BASE}/laws`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to create law');
    return data as { law: LawRecord };
  },

  async updateLaw(id: string, payload: Partial<LawPayload>) {
    const r = await fetch(`${API_BASE}/laws/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to update law');
    return data as { law: LawRecord };
  },

  async deleteLaw(id: string) {
    const r = await fetch(`${API_BASE}/laws/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers()
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to delete law');
    return data as { ok: boolean };
  },

  /** Arbitrator: list active arbitration cases (neutral list by Parcel ID) */
  async getArbitrationCases() {
    const r = await fetch(`${API_BASE}/arbitration/cases`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || data.message || 'Failed');
    return data as { success: boolean; cases: unknown[] };
  },

  /** Arbitrator: open official review (reveals full case file) */
  async startArbitrationReview(parcelId: string) {
    const r = await fetch(`${API_BASE}/arbitration/cases/${encodeURIComponent(parcelId)}/start-review`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({})
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || data.message || 'Failed');
    return data;
  },

  /** Arbitrator: evidence vault (documents, protocols, chat logs) */
  async getArbitrationEvidence(parcelId: string) {
    const r = await fetch(`${API_BASE}/arbitration/cases/${encodeURIComponent(parcelId)}/evidence`, { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || data.message || 'Failed');
    return data;
  },

  /** Arbitrator: take legal-grade action */
  async arbitrationAction(
    parcelId: string,
    payload: {
      action: 'dismiss' | 'permanent_lock' | 'corrective_transfer' | 'fraud_alert_blacklist';
      note?: string;
      toUserId?: string;
      ghanaCardPin?: string;
    }
  ) {
    const r = await fetch(`${API_BASE}/arbitration/cases/${encodeURIComponent(parcelId)}/action`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || data.message || 'Failed');
    return data;
  }
};
