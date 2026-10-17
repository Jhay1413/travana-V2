import { escapeHtml } from '../../utils/escape-html';
import { getEmailProvider } from '../../../services/email-provider';

/**
 * Tells someone their access was paused. Sent only when the admin ticked
 * "Send them an email"; a failure is logged and never thrown (the suspension
 * has already happened).
 */
export async function sendSuspensionEmail(email: string, orgName: string): Promise<void> {
  try {
    const subject = `Your access to ${orgName} on Travana has been paused`;
    const text = `Your access to ${orgName} on Travana has been paused by an administrator.\n\nIf you think this is a mistake, please contact your agency admin.`;
    const html = `
      <p>Your access to <strong>${escapeHtml(orgName)}</strong> on Travana has been paused by an administrator.</p>
      <p>If you think this is a mistake, please contact your agency admin.</p>
    `;
    await getEmailProvider().send({ to: email, subject, html, text });
  } catch (err) {
    console.error('[org-member] suspension email failed:', err);
  }
}
