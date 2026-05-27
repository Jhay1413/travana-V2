import { smsRepository } from './sms.repository';
import { getPublicBaseUrl } from '../../utils/public-url';
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

const CONNEXA_BASE = 'https://cnxa.io';
const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;
const TOKEN_REFRESH_LEAD_MS = 30_000;
const DEFAULT_SENDER = 'Quotehub by';

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
  const res = await fetch(`${CONNEXA_BASE}/api/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
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

/** Connexa sender_id rule: 3-11 chars, alphanumeric, at least one letter. */
export function sanitiseSenderId(name: string | null | undefined): string {
  const cleaned = (name ?? '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3 && /[a-zA-Z]/.test(cleaned)) return cleaned.slice(0, 11).trimEnd();
  return DEFAULT_SENDER;
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<{ sid: string; status: string }> {
  const token = await getBearerToken();
  const res = await fetch(`${CONNEXA_BASE}/api/schedule-message`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender_id: getSenderId(),
      message: body,
      contact_number: toConnexaPhone(to),
    }),
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
  return `${getPublicBaseUrl()}/view-quote/${token}`;
}

/**
 * Build the SMS template merge context for a client. Best-effort: missing
 * data leaves placeholders blank rather than throwing.
 */
export async function buildContextForClient(client: any): Promise<MergeContext> {
  const ctx: MergeContext = {
    first_name: client.firstName ?? '',
    last_name: client.surename ?? '',
    portal_link: buildPortalLink(),
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
    const bookingRow = await smsRepository.findLatestActiveBookingForClient(client.id);
    if (bookingRow) {
      ctx.hays_ref = bookingRow.hays_ref ?? '';
      ctx.supplier_ref = bookingRow.supplier_ref ?? '';
      ctx.departure_date = formatDate(bookingRow.travel_date);
      ctx.destination = bookingRow.title ?? '';
      const sales = bookingRow.sales_price ? parseFloat(String(bookingRow.sales_price)) : 0;
      const deposit = bookingRow.discounts ? parseFloat(String(bookingRow.discounts)) : 0;
      const balance = Math.max(0, sales - deposit);
      if (sales > 0) ctx.balance_due = formatGbp(balance);
      if (bookingRow.travel_date) {
        const dep = new Date(String(bookingRow.travel_date));
        if (!Number.isNaN(dep.getTime())) { dep.setDate(dep.getDate() - 14); ctx.balance_due_date = formatDate(dep); }
      }
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

/**
 * Fan out auto-fire SMS for a client. Looks up active templates with the
 * given trigger, builds the per-client context, and sends one SMS per
 * template.
 *
 * Safe to call from event handlers — never throws on per-template failure,
 * logs each outcome to `sms_messages`. The caller's flow is unaffected.
 *
 * Idempotency: when `dedupeSince` is set, templates already sent to this
 * client since that timestamp are skipped. The days-before-departure cron
 * passes `dedupeSince = start of today`; one-shot event triggers
 * (`on_booking_create`, `on_pin_set`) pass a 5-minute window so a retried
 * event doesn't double-send.
 */
export async function fireAutoTriggerForClient(opts: {
  clientId: string;
  autoTrigger: AutoTrigger;
  triggerSource?: string;
  dedupeSince?: Date;
  /** When sourced from a specific booking, pass it so context picks the right row. */
  bookingTitle?: string;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0; let skipped = 0; let failed = 0;
  try {
    const client = await smsRepository.findClientById(opts.clientId);
    if (!client) return { sent, skipped, failed };
    const phone = normalisePhone(client.phoneNumber);
    if (!client.smsOptIn || !phone) {
      return { sent, skipped: 1, failed };
    }

    // Templates are per-org — a client without an orgId can't have auto-fires
    // (would otherwise pick up templates from arbitrary orgs).
    if (!client.orgId) return { sent, skipped, failed };

    const templates = await smsRepository.findActiveTemplatesByTrigger(client.orgId, opts.autoTrigger);
    if (templates.length === 0) return { sent, skipped, failed };

    const ctx = await buildContextForClient(client);
    const clientName = `${client.firstName ?? ''} ${client.surename ?? ''}`.trim();

    for (const t of templates) {
      if (opts.dedupeSince) {
        const already = await smsRepository.hasRecentAutoSend(t.id, client.id, opts.dedupeSince);
        if (already) { skipped++; continue; }
      }

      const body = mergeTemplate(t.body, ctx);
      const baseRow = {
        templateId: t.id,
        templateName: t.name,
        clientId: client.id,
        clientName,
        toPhone: phone,
        body,
        providerMessageId: null as string | null,
        providerError: null as string | null,
        costCents: null as number | null,
        triggeredBy: null as string | null,
        triggeredByName: 'auto',
        triggerSource: opts.triggerSource ?? opts.autoTrigger,
      };

      const credit = await consumeSmsCredit(client.orgId);
      try {
        const result = await sendSms({ to: phone, body });
        const msg = await smsRepository.createMessage({ ...baseRow, status: 'sent', providerMessageId: result.sid });
        if (credit.chargeId && msg?.id) await attachChargeToMessage(credit.chargeId, msg.id);
        sent++;
      } catch (err: any) {
        const msg = await smsRepository.createMessage({ ...baseRow, status: 'failed', providerError: err?.message || String(err) });
        if (credit.chargeId && msg?.id) await attachChargeToMessage(credit.chargeId, msg.id);
        failed++;
      }
    }
  } catch (err) {
    console.error('[sms] fireAutoTriggerForClient failed:', err);
  }
  return { sent, skipped, failed };
}

export async function pingSmsConnection(): Promise<{ connected: boolean; fromPhone?: string; balance?: string; error?: string }> {
  try {
    await getBearerToken();
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err?.message ?? String(err) };
  }
}
