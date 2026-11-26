import { smsRepository } from './sms.repository';
import { getPublicBaseUrl } from '../../utils/public-url';
import { AppError } from '../../utils/error-handler';
import { formatUkDate, placeholderBalanceDueDate } from '../../utils/balance-due';
import { maskLoginCodes } from '../../utils/mask-login-code';
import { purposesForTrigger, smsRowMatchesPurpose } from '../customer-messaging/customer-messaging.purposes';
import { withAgencySignature } from '../customer-messaging/customer-messaging.seeds';
import type { SkipReason } from '../customer-messaging/customer-messaging.types';
import type { AutoMessagePurpose } from '@shared/schema';
import {
  platformAdminCreditsRepository,
  startOfMonthUtc,
  type ConsumptionRecord,
} from '../platform-admin/platform-admin-credits.repository';

/**
 * Record one outbound SMS against the org's credit allowance. Returns the
 * resulting overage charge (if any) so the caller can patch the charge with
 * the message id once it knows it.
 *
 * If credits are disabled on the org, returns enabled=false and the caller
 * proceeds normally. Failures here log and return enabled=false so a credit
 * outage never blocks tenant SMS — but in that case nothing is recorded.
 */
export async function consumeSmsCredit(orgId: string): Promise<ConsumptionRecord> {
  try {
    return await platformAdminCreditsRepository.consumeOneCredit(orgId, startOfMonthUtc());
  } catch (err) {
    console.error('[sms] credit consumption failed (open-fail; SMS will proceed):', err);
    return { enabled: false, overage: false, chargeId: null };
  }
}

export async function attachChargeToMessage(chargeId: string, smsMessageId: string): Promise<void> {
  try {
    await platformAdminCreditsRepository.attachMessageToCharge(chargeId, smsMessageId);
  } catch (err) {
    console.error('[sms] failed to attach charge to message:', err);
  }
}

const DEFAULT_CONNEXA_BASE = 'https://cnxa.io';
/** The provider address; CONNEXA_BASE_URL overrides it (the E2E suite points it at a local fake). */
function connexaBase(): string {
  return (process.env.CONNEXA_BASE_URL?.trim() || DEFAULT_CONNEXA_BASE).replace(/\/$/, '');
}

/** True when the SMS provider login is present (it is not validated here). */
export function isSmsConfigured(): boolean {
  return !!(process.env.CONNEXA_EMAIL && process.env.CONNEXA_PASSWORD);
}
const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;
const TOKEN_REFRESH_LEAD_MS = 30_000;
const DEFAULT_SENDER = 'Quotehub by';
/** A stalled Connexa call must not hold the departure sweep (and its lock) for ever. */
export const CONNEXA_TIMEOUT_MS = 15_000;

function getCreds() {
  const email = process.env.CONNEXA_EMAIL ?? '';
  const password = process.env.CONNEXA_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Connexa is not connected. Set CONNEXA_EMAIL and CONNEXA_PASSWORD as project secrets.');
  }
  return { email, password };
}

function getSenderId(): string {
  return sanitiseSenderId(process.env.CONNEXA_SENDER ?? DEFAULT_SENDER);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBearerToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_LEAD_MS) {
    return cachedToken.token;
  }
  const { email, password } = getCreds();
  const res = await fetch(`${connexaBase()}/api/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(CONNEXA_TIMEOUT_MS),
  });
  const data: any = await res.json().catch(() => ({}));
  const token = data?.access_token ?? data?.token ?? data?.response?.data?.access_token;
  if (!res.ok || !token) {
    cachedToken = null;
    const detail = data?.error_description || data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`Connexa auth failed: ${detail}`);
  }
  const ttlMs = typeof data.expires_in === 'number' ? data.expires_in * 1000 : DEFAULT_TOKEN_TTL_MS;
  cachedToken = { token, expiresAt: Date.now() + ttlMs };
  return token;
}

export interface MergeContext {
  first_name?: string | null;
  last_name?: string | null;
  destination?: string | null;
  departure_date?: string | null;
  balance_due?: string | number | null;
  balance_due_date?: string | null;
  hays_ref?: string | null;
  supplier_ref?: string | null;
  portal_link?: string | null;
  portal_email?: string | null;
  portal_pin?: string | null;
  portal_credentials?: string | null;
  agent_name?: string | null;
  company_name?: string | null;
  [key: string]: string | number | null | undefined;
}

export function mergeTemplate(body: string, ctx: MergeContext): string {
  return body.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (_m, key) => {
    const value = ctx[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function normalisePhone(raw: string | null | undefined, defaultCountry = 'GB'): string | null {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) return p;
  if (defaultCountry === 'GB') {
    if (p.startsWith('00')) return '+' + p.slice(2);
    if (p.startsWith('0')) return '+44' + p.slice(1);
    if (p.startsWith('44')) return '+' + p;
    return '+44' + p;
  }
  return '+' + p;
}

/** Connexa accepts "07..." (UK local) or "447..." (international, no plus). */
function toConnexaPhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone;
}

/**
 * Connexa sender_id accepts either:
 *  - alphanumeric: 3-11 chars with at least one letter (e.g. "YourBrand"), or
 *  - a subscribed Virtual Long Number in 447 format (digits only, up to 12 chars).
 */
export function sanitiseSenderId(name: string | null | undefined): string {
  const raw = (name ?? '').trim();
  // Subscribed Virtual Long Number (447 + up to 9 digits) — pass through as-is.
  if (/^447\d{6,9}$/.test(raw)) return raw;
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3 && /[a-zA-Z]/.test(cleaned)) return cleaned.slice(0, 11).trimEnd();
  return DEFAULT_SENDER;
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<{ sid: string; status: string }> {
  const token = await getBearerToken();
  const res = await fetch(`${connexaBase()}/api/schedule-message`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender_id: "Quotehub by",
      message: body,
      contact_number: toConnexaPhone(to),
    }),
    signal: AbortSignal.timeout(CONNEXA_TIMEOUT_MS),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error || data?.response?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(`Connexa send failed: ${detail}`);
  }
  const inner = data?.response?.data;
  return {
    sid: inner?.uuid ?? '',
    status: data?.response?.status ?? 'accepted',
  };
}

// ─── Context building & auto-trigger engine ──────────────────────────────

function formatGbp(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return '';
  return `£${n.toFixed(2)}`;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildPortalLink(): string {
  return `${getPublicBaseUrl()}/portal/login`;
}

function buildQuoteUrl(token: string): string {
  // Portal quote view (requires portal login), not the public /view-quote page.
  return `${getPublicBaseUrl()}/portal/quote/${token}`;
}

/**
 * Body of the Share dialog's primary "Send" message. ASCII only - the SMS
 * provider rejects non-GSM characters (e.g. em dash). Reused for WhatsApp so
 * both channels say the same thing. Keep in sync with the client `bodyOverride`
 * in client/src/features/quote/components/QuoteShareDialog.tsx.
 */
export const PUBLIC_QUOTE_MESSAGE_BODY =
  'Hi {{first_name}}, your quote is ready - tap to view it: {{quote_url}}{{signature}}';

export function buildPublicQuoteUrl(token: string): string {
  // Public quote view — no login/PIN required; anyone with the link can view
  // the quote. Used when the sender explicitly shares the public link instead
  // of the portal one, so we never seed a PIN or magic-login token for it.
  return `${getPublicBaseUrl()}/view-quote/${token}`;
}

/** Renders the public-link quote message for one client + quote token. */
export function buildPublicQuoteMessage(opts: {
  firstName: string | null | undefined;
  token: string;
  /** The customer's own agency, from data. Absent = no signature: a fixed agency name is never sent to a customer. */
  companyName?: string | null;
}): { text: string; quoteUrl: string } {
  const quoteUrl = buildPublicQuoteUrl(opts.token);
  const name = opts.companyName?.trim();
  const text = mergeTemplate(PUBLIC_QUOTE_MESSAGE_BODY, {
    first_name: opts.firstName ?? '',
    quote_url: quoteUrl,
    signature: name ? ` - ${name}` : '',
  });
  return { text, quoteUrl };
}

/**
 * Resolve which quote's share token to use for a client's SMS context.
 *
 * Callers that know exactly which quote is being shared (e.g. the Share
 * Quote dialog's "Send" / "Send via SMS" buttons) should pass `quoteId`, so
 * that quote's token is used even if a newer quote for the same client (e.g.
 * a copy made after it) has since been tokened too — otherwise the org's
 * most-recently-tokened quote always wins, and the agent can end up copying
 * one quote's link while the client is texted a different one. `quoteId` is
 * never trusted blindly: it's looked up scoped to `clientId` via
 * `findTokenedQuoteForClient`, so a quote belonging to a different client is
 * rejected with an `AppError` rather than silently used or silently ignored.
 *
 * Every caller that omits `quoteId` — including `fireAutoTriggerForClient`'s
 * auto-fire templates, which never have a "viewed quote" to point at — keeps
 * the original latest-tokened-quote fallback unchanged.
 */
export async function resolveQuoteToken(
  clientId: string,
  quoteId?: string,
): Promise<{ id: string; token: string } | undefined> {
  if (quoteId) {
    const row = await smsRepository.findTokenedQuoteForClient(clientId, quoteId);
    if (!row?.token) {
      throw new AppError('Quote does not belong to this client', 400);
    }
    return { id: row.id, token: row.token };
  }
  const row = await smsRepository.findLatestTokenedQuoteForClient(clientId);
  return row?.token ? { id: row.id, token: row.token } : undefined;
}

/**
 * Build the SMS template merge context for a client. Best-effort: missing
 * data leaves placeholders blank rather than throwing.
 */
export interface SmsContextClient {
  id: string;
  orgId?: string | null;
  email?: string | null;
  firstName?: string | null;
  surename?: string | null;
}

export async function buildContextForClient(client: SmsContextClient, opts: { bookingId?: string } = {}): Promise<MergeContext> {
  const email = (client.email ?? '').trim();
  const ctx: MergeContext = {
    first_name: client.firstName ?? '',
    last_name: client.surename ?? '',
    portal_link: buildPortalLink(),
    portal_email: email,
    portal_pin: '',
    // Auto-trigger sends never have a plaintext PIN (it's hashed and we don't
    // mint here). Manual quote-share minting lives in the controller path.
    portal_credentials: email ? `your email ${email} and the PIN we shared` : '',
    company_name: '',
    destination: '',
    departure_date: '',
    balance_due: '',
    balance_due_date: '',
    hays_ref: '',
    supplier_ref: '',
    quote_url: '',
  };
  if (client.orgId) {
    try {
      const orgName = await smsRepository.findOrgNameById(client.orgId);
      if (orgName) ctx.company_name = orgName;
    } catch { /* best-effort */ }
  }
  try {
    // A named booking (the departure sweep) is used as is; if it is gone the fields stay
    // blank rather than describing a different trip. Event triggers have no booking id
    // and use the client's latest active booking.
    const bookingRow = opts.bookingId
      ? await smsRepository.findActiveBookingForClient(client.id, opts.bookingId)
      : await smsRepository.findLatestActiveBookingForClient(client.id);
    if (bookingRow) {
      ctx.hays_ref = bookingRow.hays_ref ?? '';
      ctx.supplier_ref = bookingRow.supplier_ref ?? '';
      ctx.departure_date = formatUkDate(bookingRow.travel_date);
      ctx.destination = bookingRow.title ?? '';
      const sales = bookingRow.sales_price ? parseFloat(String(bookingRow.sales_price)) : 0;
      const deposit = bookingRow.discounts ? parseFloat(String(bookingRow.discounts)) : 0;
      const balance = Math.max(0, sales - deposit);
      if (sales > 0) ctx.balance_due = formatGbp(balance);
      // Placeholder rule carried over from the original reminder (see balance-due.ts): departure minus 14 days.
      const due = placeholderBalanceDueDate(bookingRow.travel_date);
      if (due) ctx.balance_due_date = formatUkDate(due);
    }
  } catch { /* best-effort */ }
  try {
    const quoteRow = await smsRepository.findLatestTokenedQuoteForClient(client.id);
    if (quoteRow?.token) ctx.quote_url = buildQuoteUrl(quoteRow.token);
  } catch { /* best-effort */ }
  return ctx;
}

export type AutoTrigger =
  | 'on_booking_create'
  | 'on_pin_set'
  | 'days_before_departure';

/** One tracked SMS: credit consumed, sent, logged in sms_messages (sent or failed), charge attached. */
export interface TrackedSmsInput {
  orgId: string;
  templateId: string | null;
  templateName: string;
  clientId: string;
  clientName: string;
  phone: string;
  body: string;
  triggerSource: string;
  triggeredBy?: string | null;
  triggeredByName?: string;
}

export type TrackedSmsOutcome = { ok: true; providerMessageId: string } | { ok: false; error: string };

export async function sendTrackedSms(input: TrackedSmsInput): Promise<TrackedSmsOutcome> {
  const baseRow = {
    templateId: input.templateId,
    templateName: input.templateName,
    clientId: input.clientId,
    clientName: input.clientName,
    toPhone: input.phone,
    // The log is readable by staff: a live sign-in code is never kept there (the sent message keeps it).
    body: maskLoginCodes(input.body),
    providerMessageId: null as string | null,
    providerError: null as string | null,
    costCents: null as number | null,
    triggeredBy: input.triggeredBy ?? null,
    triggeredByName: input.triggeredByName ?? 'auto',
    triggerSource: input.triggerSource,
  };
  const credit = await consumeSmsCredit(input.orgId);
  try {
    const result = await sendSms({ to: input.phone, body: input.body });
    const msg = await smsRepository.createMessage({ ...baseRow, status: 'sent', providerMessageId: result.sid });
    if (credit.chargeId && msg?.id) await attachChargeToMessage(credit.chargeId, msg.id);
    return { ok: true, providerMessageId: result.sid };
  } catch (err: any) {
    const error = err?.message || String(err);
    const msg = await smsRepository.createMessage({ ...baseRow, status: 'failed', providerError: error });
    if (credit.chargeId && msg?.id) await attachChargeToMessage(credit.chargeId, msg.id);
    return { ok: false, error };
  }
}

export interface AutoSmsResult {
  sent: number;
  skipped: number;
  failed: number;
  suspended?: true;
  /** Why nothing was sent, when nothing was (the last skip or failure). */
  reason?: SkipReason;
  /** First template that was sent. */
  templateName?: string;
  providerMessageId?: string;
}

/**
 * The SMS branch of automatic customer messages: today's per-template behaviour. Looks up active
 * templates with the given trigger (optionally only the rows of one message type), builds the
 * per-client context, and sends one SMS per template.
 *
 * Safe to call from event handlers - never throws on per-template failure, logs each outcome to
 * `sms_messages`. The caller's flow is unaffected.
 *
 * Idempotency: when `dedupeSince` is set, templates already sent to this client since that
 * timestamp are skipped. The days-before-departure cron passes `dedupeSince = start of today`;
 * one-shot event triggers (`on_booking_create`, `on_pin_set`) pass a 5-minute window so a
 * retried event doesn't double-send.
 */
export async function sendAutoSmsTemplates(opts: {
  clientId: string;
  autoTrigger: AutoTrigger;
  triggerSource?: string;
  dedupeSince?: Date;
  /** Departure sweep only: fire just the templates configured for this many days before. */
  triggerDaysBefore?: number;
  /** When sourced from a specific booking, pass it so context picks the right row. */
  bookingTitle?: string;
  /** The booking that fired this send (the departure sweep); lets paid bookings skip balance reminders. */
  bookingId?: string;
  /** Only the rows that switch this message type on (balance vs. other reminders share one trigger). */
  purpose?: AutoMessagePurpose;
}): Promise<AutoSmsResult> {
  let sent = 0; let skipped = 0; let failed = 0;
  let reason: SkipReason | undefined;
  let templateName: string | undefined;
  let providerMessageId: string | undefined;
  try {
    const client = await smsRepository.findClientById(opts.clientId);
    if (!client) return { sent, skipped, failed, reason: 'client_not_found' };
    const phone = normalisePhone(client.phoneNumber);
    if (!client.smsOptIn || !phone) {
      return { sent, skipped: 1, failed, reason: !client.smsOptIn ? 'opted_out' : 'no_phone' };
    }

    // Templates are per-org — a client without an orgId can't have auto-fires
    // (would otherwise pick up templates from arbitrary orgs).
    if (!client.orgId) return { sent, skipped, failed, reason: 'client_not_found' };

    // A suspended organisation sends nothing automatically and must not use SMS credit.
    if (!(await smsRepository.isOrgActive(client.orgId))) {
      return { sent, skipped: 1, failed, suspended: true, reason: 'org_suspended' };
    }

    const found = await smsRepository.findActiveTemplatesByTrigger(client.orgId, opts.autoTrigger);
    const byDays = opts.triggerDaysBefore === undefined
      ? found
      : found.filter((t) => t.triggerDaysBefore === opts.triggerDaysBefore);
    const purpose = opts.purpose;
    const templates = purpose ? byDays.filter((t) => smsRowMatchesPurpose(t, purpose)) : byDays;
    if (templates.length === 0) return { sent, skipped, failed, reason: 'switched_off' };

    const ctx = await buildContextForClient(client, { bookingId: opts.bookingId });
    const clientName = `${client.firstName ?? ''} ${client.surename ?? ''}`.trim();

    // Looked up lazily, once: only a balance_due template cares whether the booking is fully paid.
    let fullyPaid: boolean | undefined;
    for (const t of templates) {
      if (opts.autoTrigger === 'days_before_departure' && opts.bookingId && t.category === 'balance_due') {
        fullyPaid ??= await smsRepository.isBookingFullyPaid(opts.bookingId);
        if (fullyPaid) { skipped++; reason = 'fully_paid'; continue; }
      }
      if (opts.dedupeSince) {
        const already = await smsRepository.hasRecentAutoSend(t.id, client.id, opts.dedupeSince);
        if (already) { skipped++; reason = 'duplicate'; continue; }
      }

      // A message that promises a quote link is not sent with a blank one (no quote the customer can still open).
      if (/\{\{?\s*quote_url\s*\}?\}/.test(t.body) && !ctx.quote_url) { skipped++; reason = 'no_quote_link'; continue; }
      const outcome = await sendTrackedSms({
        orgId: client.orgId,
        templateId: t.id,
        templateName: t.name,
        clientId: client.id,
        clientName,
        phone,
        body: mergeTemplate(withAgencySignature(t.body, ctx.company_name), ctx),
        triggerSource: opts.triggerSource ?? opts.autoTrigger,
      });
      if (outcome.ok) {
        sent++;
        templateName ??= t.name;
        providerMessageId ??= outcome.providerMessageId;
      } else {
        failed++;
        reason = 'send_failed';
      }
    }
  } catch (err) {
    console.error('[sms] fireAutoTriggerForClient failed:', err);
  }
  return {
    sent, skipped, failed,
    ...(sent === 0 && reason ? { reason } : {}),
    ...(templateName ? { templateName } : {}),
    ...(providerMessageId ? { providerMessageId } : {}),
  };
}

/** Which message types fire for a trigger. */
export function purposesFor(trigger: AutoTrigger): AutoMessagePurpose[] {
  return trigger === 'on_booking_create' || trigger === 'on_pin_set' || trigger === 'days_before_departure'
    ? purposesForTrigger(trigger)
    : [];
}

/**
 * Entry point for booking created, PIN set and the departure sweep. Hands each message type to the
 * customer-messaging dispatcher, which sends by the agency's chosen channel (WhatsApp by default,
 * SMS when set) and logs the outcome. Never throws; the caller's flow is unaffected.
 *
 * Loaded on demand because the dispatcher itself builds on this file (the SMS branch above).
 */
export async function fireAutoTriggerForClient(opts: {
  clientId: string;
  autoTrigger: AutoTrigger;
  triggerSource?: string;
  dedupeSince?: Date;
  triggerDaysBefore?: number;
  bookingTitle?: string;
  bookingId?: string;
}): Promise<{ sent: number; skipped: number; failed: number; suspended?: true }> {
  try {
    const { customerMessagingService } = await import('../customer-messaging/customer-messaging.service');
    return await customerMessagingService.fireAutoTrigger(opts);
  } catch (err) {
    console.error('[sms] fireAutoTriggerForClient failed:', err);
    return { sent: 0, skipped: 0, failed: 0 };
  }
}

export async function pingSmsConnection(): Promise<{ connected: boolean; fromPhone?: string; balance?: string; error?: string }> {
  try {
    await getBearerToken();
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err?.message ?? String(err) };
  }
}
              