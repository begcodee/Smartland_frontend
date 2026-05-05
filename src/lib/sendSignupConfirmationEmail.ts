/**
 * Optional confirmation email to the registrant after successful `/auth/register`.
 * Configure EmailJS (https://www.emailjs.com): template "To" field must use {{to_email}}.
 */
import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID?.trim();
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID?.trim();
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY?.trim();

export function isSignupEmailConfigured(): boolean {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

export async function sendSignupConfirmationEmail(params: {
  toEmail: string;
  name: string;
}): Promise<void> {
  if (!isSignupEmailConfigured()) return;

  await emailjs.send(
    SERVICE_ID!,
    TEMPLATE_ID!,
    {
      to_email: params.toEmail,
      user_name: params.name,
      app_name: 'SmartLand',
    },
    { publicKey: PUBLIC_KEY! }
  );
}
