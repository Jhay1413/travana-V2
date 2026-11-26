import { getPublicBaseUrl } from '../../utils/public-url';
import { normalisePhone } from '../sms/sms.service';
import { normalizeOrgSlug } from './portal-org-slug';
import { InMemoryPinResetLimiter, PIN_RESET_MAX_TEXTS, PIN_RESET_WINDOW_MS, pinResetKey, type PinResetLimiter } from './portal-pin-reset-limiter';
import { customerMessagingService, SettingsUnavailableError } from '../customer-messaging/customer-messaging.service';
import type { AutoChannel } from '../customer-messaging/customer-messaging.types';
import type { SkipReason } from '../customer-messaging/customer-messaging.types';
import { sendPinResetWhatsapp, type PinResetSkipReason } from './portal-pin-reset-sender';
import { buildSignInText } from './portal-pin-reset-text';
import { portalPinResetRepository, type ReserveLinkResult } from './portal-pin-reset.repository';
import { portalRepository } from './portal.repository';
import type { LoginCandidate } from './portal.types';
import type { PortalPinResetBody } from './portal-pin-reset.validator';

export { buildSignInText };

/** The reply every valid request gets, whether or not a message was sent. */
export const PIN_RESET_REPLY_MESSAGE = "If we have your details, we've sent you a sign-in link.";

/** The sign-in link works once and is short-lived: it is the only way back in without the PIN. */
export const PIN_RESET_LINK_TTL_MS = 60 * 60 * 1000;

/** Where the link lands after signing in: the Account page with the "choose a new PIN" form open. */
export const PIN_RESET_NEXT_PATH = '/portal/account?change-pin=1';

/** Most sign-in messages one agency can have minted in 24 hours, whoever asks (confirmed by the owner). */
export const PIN_RESET_MAX_PER_ORG_PER_DAY = 20;

/** Every request takes at least this long, so "found and messaged" cannot be told from "nothing to do" by timing. */
export const pinResetTiming = { minMs: 600 };

/** One allowance store for the process; swap for a database-backed PinResetLimiter later. Exported so tests can clear it. */
export const portalPinResetLimiter = new InMemoryPinResetLimiter();
const limiter: PinResetLimiter = portalPinResetLimiter;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * May this customer use "Forgotten your PIN?". The owner's decision: yes, including a customer with no
 * portal PIN on record at all (the link signs them in and the Account page then asks for a PIN).
 * One named rule so a change is one line here.
 */
export function mayRequestPinReset(_candidate: LoginCandidate): boolean {
  return true;
}

/** A broken reservation (e.g. the `source` column is missing) is logged at most this often. */
export const PIN_RESET_ERROR_LOG_INTERVAL_MS = 60 * 1000;
let lastReserveErrorLogAt = 0;

/** How the WhatsApp sender's skip reasons read in the customer message log. */
const PIN_RESET_REASON_MAP: Record<PinResetSkipReason, SkipReason> = {
  not_configured: 'not_connected',
  no_channel: 'no_channel',
  no_template: 'no_template',
  capped: 'capped',
  send_failed: 'send_failed',
};

/** Does the lookups and the send. Called in the background, never awaited by the request. */
async function resetPin(input: PortalPinResetBody): Promise<void> {
  const email = input.email.trim().slice(0, 254);

  let orgId: string | undefined;
  if (input.org) {
    const slug = normalizeOrgSlug(input.org);
    if (!slug) return;
    const resolved = await portalRepository.findActiveOrgIdBySlug(slug);
    if (!resolved) return;
    orgId = resolved;
  }

  // Same lookup as sign-in. Without an agency, only one unambiguous customer qualifies.
  const candidates = await portalRepository.findLoginCandidates(email, orgId, 2);
  const target = orgId ? candidates[0] : candidates.length === 1 ? candidates[0] : undefined;
  if (!target || !mayRequestPinReset(target)) return;

  const info = await portalPinResetRepository.findTarget(target.id);
  if (!info || !info.orgId) return;
  // A suspended agency sends nothing automatically.
  if (!info.orgActive) return;
  // No phone number on file: there is nowhere to send it.
  const phone = normalisePhone(info.phoneNumber);
  if (!phone) return;

  // A link with no site address in front of it is useless: send nothing.
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    console.warn(`[portal-pin-reset] nothing sent for client ${target.id}: no_public_url`);
    return;
  }

  // In-memory peek first (cheap, per agency and email). The durable, atomic cap check happens in `reserve`, which
  // the sender calls only after it has worked out that a message can really be sent.
  const key = pinResetKey(`${info.orgId}|${email}`);
  if (!limiter.isAllowed(key)) return;

  const orgIdForReserve = info.orgId;
  const reserve = async (): Promise<string | null> => {
    let result: ReserveLinkResult;
    try {
      result = await portalPinResetRepository.reserveLink({
        clientId: target.id,
        orgId: orgIdForReserve,
        email,
        since: new Date(Date.now() - PIN_RESET_WINDOW_MS),
        maxPerEmail: PIN_RESET_MAX_TEXTS,
        maxPerOrg: PIN_RESET_MAX_PER_ORG_PER_DAY,
        ttlMs: PIN_RESET_LINK_TTL_MS,
      });
    } catch (err) {
      // Cannot count or mint (e.g. the `source` column is not in this database yet): fail closed, for this feature only.
      const now = Date.now();
      if (now - lastReserveErrorLogAt >= PIN_RESET_ERROR_LOG_INTERVAL_MS) {
        lastReserveErrorLogAt = now;
        console.error('[portal-pin-reset] cannot reserve a sign-in link; sending none (is portal_login_tokens.source in the database?):', err);
      }
      return null;
    }
    if (!result.reserved) return null;
    limiter.record(key);
    return `${baseUrl}/portal/login?mt=${result.code}&next=${encodeURIComponent(PIN_RESET_NEXT_PATH)}`;
  };

  // The agency's channel for automatic customer messages (WhatsApp unless it has chosen SMS).
  let channel: AutoChannel;
  try {
    channel = await customerMessagingService.getAutoChannel(info.orgId);
  } catch (err) {
    if (!(err instanceof SettingsUnavailableError)) throw err;
    // The setting cannot be read: nothing is sent (never a guess at the channel); the customer sees the usual reply.
    console.warn(`[portal-pin-reset] nothing sent for client ${target.id}: settings_unavailable`);
    await customerMessagingService.recordOutcome({
      orgId: orgIdForReserve,
      clientId: target.id,
      purpose: 'portal_sign_in',
      channel: 'unknown',
      triggerSource: 'portal.pin-reset',
      outcome: { status: 'skipped', reason: 'settings_unavailable' },
    });
    return;
  }
  const log = (outcome: { status: 'sent' } | { status: 'skipped'; reason: SkipReason }, templateName?: string) =>
    customerMessagingService.recordOutcome({
      orgId: orgIdForReserve,
      clientId: target.id,
      purpose: 'portal_sign_in',
      channel,
      triggerSource: 'portal.pin-reset',
      templateName,
      outcome,
    });

  if (channel === 'sms') {
    // Goes even if the customer has opted out of automatic messages: they asked for this one.
    const sms = await customerMessagingService.sendSignInLinkBySms({
      orgId: info.orgId,
      clientId: target.id,
      firstName: info.firstName,
      orgName: info.orgName,
      phone,
      reserve,
    });
    if (sms.status === 'skipped') console.warn(`[portal-pin-reset] nothing sent for client ${target.id}: ${sms.reason}`);
    await log(sms.status === 'sent' ? { status: 'sent' } : { status: 'skipped', reason: sms.reason });
    return;
  }

  const outcome = await sendPinResetWhatsapp({
    orgId: info.orgId,
    clientId: target.id,
    firstName: info.firstName,
    orgName: info.orgName,
    phone,
    reserve,
  });
  if (outcome.status === 'skipped') console.warn(`[portal-pin-reset] nothing sent for client ${target.id}: ${outcome.reason}`);
  await log(outcome.status === 'sent' ? { status: 'sent' } : { status: 'skipped', reason: PIN_RESET_REASON_MAP[outcome.reason] });
}

export const portalPinResetService = {
  /** The lookups and the send, with every failure logged and swallowed. Exposed so tests can await it. */
  async processReset(input: PortalPinResetBody): Promise<void> {
    try {
      await resetPin(input);
    } catch (err) {
      console.error('[portal-pin-reset] failed:', err);
    }
  },

  /**
   * "Forgotten your PIN?": the lookups and the message happen in the background, and this resolves
   * after a fixed floor whatever they find, so timing says nothing about whether an account exists.
   */
  async requestReset(input: PortalPinResetBody): Promise<void> {
    void portalPinResetService.processReset(input);
    await sleep(pinResetTiming.minMs);
  },
};
