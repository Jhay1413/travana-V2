import { Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { smsRepository } from './sms.repository';
import { pingSmsConnection, sendSms, mergeTemplate, normalisePhone } from './sms.service';
import { db } from '../../config/database';
import { user as userTable, transaction as transactionTable, booking as bookingTable } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getUserId } from '../../utils/get-user-id';
import { getScope, type Scope } from '../../utils/scope';

const BULK_CONFIRM_THRESHOLD = 25;
const MAX_RECIPIENTS_PER_REQUEST = 500;
const IDEMPOTENCY_WINDOW_MS = 60_000;
const recentSendKeys = new Map<string, number>();

function pruneIdempotencyCache() {
  const now = Date.now();
  recentSendKeys.forEach((ts, k) => { if (now - ts > IDEMPOTENCY_WINDOW_MS) recentSendKeys.delete(k); });
}

function buildIdempotencyKey(payload: unknown, userId: string): string {
  return crypto.createHash('sha256').update(JSON.stringify({ payload, userId })).digest('hex');
}

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
}

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

const DEFAULT_TEMPLATES = [
  { name: 'Weekly Deals', category: 'weekly_deals' as const, body: 'Hi {{first_name}}, this week\'s hottest holiday deals just dropped. Check them out: {{portal_link}} - Tina\'s Travel', autoTrigger: 'manual' as const },
  { name: 'Balance Due Reminder', category: 'balance_due' as const, body: 'Hi {{first_name}}, a friendly reminder that your balance of {{balance_due}} for your {{destination}} trip is due by {{balance_due_date}}. Reply or call us if you need help. - Tina\'s Travel', autoTrigger: 'days_before_departure' as const },
  { name: 'Booking Confirmation', category: 'booking_confirmation' as const, body: 'Hi {{first_name}}, your booking to {{destination}} is confirmed! Reference: {{hays_ref}}. We\'ll be in touch with next steps. - Tina\'s Travel', autoTrigger: 'on_booking_create' as const },
  { name: 'Tickets Ready', category: 'tickets_ready' as const, body: 'Hi {{first_name}}, great news - your tickets for {{destination}} are ready! Log in to your portal to view: {{portal_link}} - Tina\'s Travel', autoTrigger: 'on_tickets_uploaded' as const },
  { name: 'Portal Login', category: 'portal_login' as const, body: 'Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina\'s Travel', autoTrigger: 'on_pin_set' as const },
];

async function ensureSeed() {
  const count = await smsRepository.countTemplates();
  if (count > 0) return;
  for (const t of DEFAULT_TEMPLATES) {
    await smsRepository.createTemplate({
      name: t.name, category: t.category, body: t.body, autoTrigger: t.autoTrigger, active: true,
      triggerDaysBefore: t.category === 'balance_due' ? 14 : null, triggerWeekday: null, triggerHour: null, createdBy: null,
    });
  }
}

async function requireAdminOrManager(req: Request) {
  const userId = getUserId(req);
  if (!userId) throw new AppError('Not authenticated', 401);
  const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  if (!u) throw new AppError('User not found', 404);
  const role = (u.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') throw new AppError('Only Admin or Manager can manage texts', 403);
  // orgId comes from the orgBranchScope middleware. Platform admins see across orgs.
  const orgId = req.orgRole === 'platform_admin' ? null : (req.orgId || null);
  if (req.orgRole !== 'platform_admin' && !orgId) {
    throw new AppError('No organisation context', 403);
  }
  return { user: u, userId, orgId };
}

function buildPortalLink() {
  const base = process.env.PUBLIC_BASE_URL || process.env.REPLIT_URL || '';
  return `${base.replace(/\/$/, '')}/portal/login`;
}

async function buildContextForClient(client: any) {
  const ctx: any = {
    first_name: client.firstName, last_name: client.surename, portal_link: buildPortalLink(),
    company_name: "Tina's Travel", destination: '', departure_date: '', balance_due: '', balance_due_date: '', hays_ref: '', supplier_ref: '',
  };
  try {
    const [latestTxn] = await db.select().from(transactionTable).where(eq(transactionTable.client_id, client.id)).orderBy(desc(transactionTable.created_at)).limit(1);
    if (!latestTxn) return ctx;
    const [bookingRow] = await db.select().from(bookingTable).where(and(eq(bookingTable.transaction_id, latestTxn.id), eq(bookingTable.is_active, true))).limit(1);
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
  return ctx;
}

export const smsController = {
  status: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    const ping = await pingSmsConnection();
    return successResponse(res, ping, 'SMS provider status');
  }),

  listTemplates: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    await ensureSeed();
    const rows = await smsRepository.listTemplates();
    return successResponse(res, rows, 'Templates retrieved');
  }),

  previewRecipients: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    const scope = getScope(req);
    const recipients = req.body?.recipients;
    if (!recipients || typeof recipients !== 'object') throw new AppError('recipients filter is required', 400);
    const clients = await smsRepository.resolveRecipients({ ...recipients, orgId: effectiveOrgId(scope) });
    const eligible = clients.filter((c) => c.smsOptIn && c.phoneNumber);
    return successResponse(res, {
      total: clients.length, eligible: eligible.length,
      skippedOptOut: clients.filter((c) => !c.smsOptIn).length,
      skippedNoPhone: clients.filter((c) => c.smsOptIn && !c.phoneNumber).length,
      confirmRequired: clients.length > BULK_CONFIRM_THRESHOLD, maxAllowed: MAX_RECIPIENTS_PER_REQUEST,
    }, 'Recipient preview');
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = await requireAdminOrManager(req);
    const row = await smsRepository.createTemplate({ ...req.body, createdBy: userId });
    return successResponse(res, row, 'Template created', 201);
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    const row = await smsRepository.updateTemplate(req.params.id as string, req.body);
    if (!row) throw new AppError('Template not found', 404);
    return successResponse(res, row, 'Template updated');
  }),

  deleteTemplate: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    await smsRepository.deleteTemplate(req.params.id as string);
    return successResponse(res, null, 'Template deleted');
  }),

  send: asyncHandler(async (req: Request, res: Response) => {
    const { user, userId } = await requireAdminOrManager(req);
    const scope = getScope(req);
    const orgId = effectiveOrgId(scope);
    const { templateId, bodyOverride, recipients, triggerSource, confirmBulk } = req.body as any;

    let template: { id?: string; name?: string; body: string } | null = null;
    if (templateId) {
      const t = await smsRepository.findTemplate(templateId);
      if (!t) throw new AppError('Template not found', 404);
      template = { id: t.id, name: t.name, body: t.body };
    }
    const baseBody = bodyOverride ?? template?.body;
    if (!baseBody) throw new AppError('templateId or bodyOverride is required', 400);

    pruneIdempotencyCache();
    const idemKey = buildIdempotencyKey({ templateId: templateId ?? null, bodyOverride: bodyOverride ?? null, recipients }, userId);
    const lastFired = recentSendKeys.get(idemKey);
    if (lastFired && Date.now() - lastFired < IDEMPOTENCY_WINDOW_MS) {
      throw new AppError('Duplicate send blocked. Wait 60 seconds before re-sending the same payload.', 429);
    }

    const clients = await smsRepository.resolveRecipients({ ...recipients, orgId });
    if (clients.length === 0) return successResponse(res, { sent: 0, skipped: 0, failed: 0, results: [] }, 'No recipients matched the selection');
    if (clients.length > MAX_RECIPIENTS_PER_REQUEST) throw new AppError(`Too many recipients (${clients.length}). Hard cap is ${MAX_RECIPIENTS_PER_REQUEST} per request.`, 400);
    if (clients.length > BULK_CONFIRM_THRESHOLD && !confirmBulk) throw new AppError(`Bulk send to ${clients.length} recipients requires confirmation. Re-submit with confirmBulk=true.`, 400);

    recentSendKeys.set(idemKey, Date.now());
    const performerName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || null;
    let sent = 0; let skipped = 0; let failed = 0;
    const results: any[] = [];

    for (const c of clients) {
      const ctx = await buildContextForClient(c);
      const body = mergeTemplate(baseBody, ctx);
      const phone = normalisePhone(c.phoneNumber);
      const clientName = `${c.firstName ?? ''} ${c.surename ?? ''}`.trim();
      const msgBase = { templateId: template?.id ?? null, templateName: template?.name ?? null, clientId: c.id, clientName, body, providerMessageId: null, providerError: null, costCents: null, triggeredBy: userId, triggeredByName: performerName, triggerSource: triggerSource || 'manual' };

      if (!c.smsOptIn) {
        await smsRepository.createMessage({ ...msgBase, toPhone: phone || c.phoneNumber || '', status: 'skipped_optout' });
        skipped++; results.push({ clientId: c.id, status: 'skipped_optout' }); continue;
      }
      if (!phone) {
        await smsRepository.createMessage({ ...msgBase, toPhone: c.phoneNumber || '', status: 'skipped_no_phone' });
        skipped++; results.push({ clientId: c.id, status: 'skipped_no_phone' }); continue;
      }
      try {
        const result = await sendSms({ to: phone, body });
        await smsRepository.createMessage({ ...msgBase, toPhone: phone, status: 'sent', providerMessageId: result.sid });
        sent++; results.push({ clientId: c.id, status: 'sent', sid: result.sid });
      } catch (err: any) {
        await smsRepository.createMessage({ ...msgBase, toPhone: phone, status: 'failed', providerError: err?.message || String(err) });
        failed++; results.push({ clientId: c.id, status: 'failed', error: err?.message });
      }
    }
    return successResponse(res, { sent, skipped, failed, total: clients.length, results }, `Sent ${sent}, skipped ${skipped}, failed ${failed}`);
  }),

  listMessages: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    const scope = getScope(req);
    const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1000);
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
    const rows = await smsRepository.listMessages({ limit, clientId, orgId: effectiveOrgId(scope) });
    return successResponse(res, rows, 'Messages retrieved');
  }),

  setOptIn: asyncHandler(async (req: Request, res: Response) => {
    await requireAdminOrManager(req);
    const scope = getScope(req);
    const orgId = effectiveOrgId(scope);
    const { id } = req.params;
    const { smsOptIn } = req.body;

    if (orgId) {
      const client = await smsRepository.findClientByIdInOrg(id, orgId);
      if (!client) throw new AppError('Client not found', 404);
    }

    await smsRepository.setClientOptIn(id, !!smsOptIn);
    return successResponse(res, { id, smsOptIn: !!smsOptIn }, 'Opt-in updated');
  }),
};
