import crypto from 'crypto';
import { escapeHtml } from '../../utils/escape-html';
import { getPublicBaseUrl } from '../../utils/public-url';
import { isProductionRuntime, resolveLinkBase } from '../../utils/link-base';
import { getEmailProvider } from '../../../services/email-provider';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function buildInviteUrl(token: string, requestOrigin?: string | null): string {
  const base = resolveLinkBase({ configured: getPublicBaseUrl(), requestOrigin, isProduction: isProductionRuntime() });
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

function buildInviteEmail(orgName: string, inviterName: string | null, url: string) {
  const subject = `You've been invited to join ${orgName} on Travana`;
  const text = `${inviterName ? `${inviterName} has` : 'You have been'} invited you to join ${orgName} on Travana.

Click the link below to set up your account:
${url}

This invitation expires in 7 days.`;
  const html = `
    <p>${inviterName ? `<strong>${escapeHtml(inviterName)}</strong> has` : 'You have been'} invited you to join <strong>${escapeHtml(orgName)}</strong> on Travana.</p>
    <p>Click the button below to set up your account:</p>
    <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Accept invitation</a></p>
    <p style="color:#888;font-size:12px">This invitation expires in 7 days.</p>
  `;
  return { subject, text, html };
}

/** Fresh invite token + expiry, shared by every flow that issues an invite. */
export function newInviteCredentials(): { token: string; expiry: Date } {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expiry: new Date(Date.now() + INVITE_TTL_MS),
  };
}

/** Sends the invite email; failures are logged, never thrown (the invite is already recorded). */
export async function sendInviteEmail(email: string, orgName: string, token: string, requestOrigin?: string | null): Promise<void> {
  try {
    const url = buildInviteUrl(token, requestOrigin);
    const { subject, html, text } = buildInviteEmail(orgName, null, url);
    const provider = getEmailProvider();
    await provider.send({ to: email, subject, html, text });
  } catch (err) {
    console.error('[invite] email failed (invite still recorded):', err);
  }
}
