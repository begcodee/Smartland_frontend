/**
 * Optional email to the applicant when Lands Commission verifies or rejects (EmailJS).
 *
 * Supports both the new `result/reference/reason` vars and legacy template vars for compatibility.
 */
import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID?.trim();
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_LC_DECISION_TEMPLATE_ID?.trim();
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY?.trim();

export function isLandsCommissionDecisionEmailConfigured(): boolean {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

export async function sendLandsCommissionDecisionEmail(params: {
  toEmail: string;
  name: string;
  approved: boolean;
  referenceId?: string | null;
  reason?: string | null;
}): Promise<void> {
  if (!isLandsCommissionDecisionEmailConfigured()) return;

  const result = params.approved ? 'verified' : 'rejected';

  await emailjs.send(
    SERVICE_ID!,
    TEMPLATE_ID!,
    {
      to_email: params.toEmail,
      user_name: params.name,
      app_name: 'SmartLand',

      // Preferred vars
      result,
      reference: params.referenceId ?? '',
      reason: params.reason?.trim() || '',

      // Legacy vars (if the template still uses them)
      nia_result: result,
      nia_reference: params.referenceId ?? '',
      nia_reason: params.reason?.trim() || '',
    },
    { publicKey: PUBLIC_KEY! }
  );
}

