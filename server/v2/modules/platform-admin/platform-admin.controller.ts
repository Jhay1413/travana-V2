import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';
import {
  platformAdminService,
  type AdminActor,
  type AssignableOrgRole,
} from './platform-admin.service';
import { platformAdminCreditsService } from './platform-admin-credits.service';

function getStrParam(req: Request, key: string): string {
  const raw = req.params[key];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val) throw new AppError(`${key} is required`, 400);
  return val;
}

function buildActor(req: Request): AdminActor {
  const userId = getUserId(req);
  if (!userId) throw new AppError('Unauthorized', 401);
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return {
    userId,
    ipAddress: fwd || req.socket.remoteAddress || null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}

export const platformAdminController = {
  listOrgs: asyncHandler(async (_req: Request, res: Response) => {
    const data = await platformAdminService.listOrganizations();
    successResponse(res, data);
  }),

  getOrg: asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminService.getOrganization(getStrParam(req, 'id'));
    successResponse(res, data);
  }),

  suspend: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const reason = String(req.body?.reason ?? '');
    await platformAdminService.suspend(getStrParam(req, 'id'), actor, reason);
    successResponse(res, null, 'Organization suspended');
  }),

  activate: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    await platformAdminService.activate(getStrParam(req, 'id'), actor);
    successResponse(res, null, 'Organization activated');
  }),

  changePlan: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const { plan, seatLimit } = req.body as { plan: string; seatLimit?: number };
    await platformAdminService.changePlan(getStrParam(req, 'id'), plan, seatLimit, actor);
    successResponse(res, null, 'Plan updated');
  }),

  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const { orgId, search, limit, offset } = req.query as Record<string, string | undefined>;
    const data = await platformAdminService.listUsersAcrossOrgs({
      orgId:  orgId  || undefined,
      search: search || undefined,
      limit:  Number(limit  ?? 50),
      offset: Number(offset ?? 0),
    });
    successResponse(res, data);
  }),

  getUser: asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminService.getUserAcrossOrgs(getStrParam(req, 'id'));
    successResponse(res, data);
  }),

  listOrgUsers: asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminService.listUsersByOrg(getStrParam(req, 'id'));
    successResponse(res, data);
  }),

  changeUserRole: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId  = getStrParam(req, 'id');
    const userId = getStrParam(req, 'userId');
    const orgRole = req.body?.orgRole as AssignableOrgRole;
    await platformAdminService.changeUserOrgRole(orgId, userId, orgRole, actor);
    successResponse(res, null, 'User role updated');
  }),

  deactivateUser: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId  = getStrParam(req, 'id');
    const userId = getStrParam(req, 'userId');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await platformAdminService.deactivateUser(orgId, userId, actor, reason);
    successResponse(res, null, 'User deactivated');
  }),

  reactivateUser: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId  = getStrParam(req, 'id');
    const userId = getStrParam(req, 'userId');
    await platformAdminService.reactivateUser(orgId, userId, actor);
    successResponse(res, null, 'User reactivated');
  }),

  listOrgBranches: asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminService.listBranchesByOrg(getStrParam(req, 'id'));
    successResponse(res, data);
  }),

  impersonate: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId = getStrParam(req, 'id');
    const org = await platformAdminService.startImpersonation(orgId, actor);
    // Shadow flag on the session. orgBranchScope + resolveOrgAndBranchForUser
    // honor this when user.role === 'platform_admin'.
    req.session.impersonateOrgId   = orgId;
    req.session.impersonateActorId = actor.userId;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    successResponse(res, { orgId, orgName: org.name }, 'Impersonating organization');
  }),

  stopImpersonating: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId = req.session.impersonateOrgId ?? null;
    await platformAdminService.stopImpersonation(orgId, actor);
    delete req.session.impersonateOrgId;
    delete req.session.impersonateActorId;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    successResponse(res, null, 'Stopped impersonating');
  }),

  getCreditSummary: asyncHandler(async (req: Request, res: Response) => {
    const data = await platformAdminCreditsService.getSummary(getStrParam(req, 'id'));
    successResponse(res, data);
  }),

  updateCreditLimit: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId = getStrParam(req, 'id');
    const { limit, enabled } = req.body as { limit: number; enabled?: boolean };
    await platformAdminCreditsService.updateLimit(orgId, limit, enabled, actor);
    successResponse(res, null, 'Credit limit updated');
  }),

  updateOveragePrice: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId = getStrParam(req, 'id');
    const { priceCents } = req.body as { priceCents: number };
    await platformAdminCreditsService.updateOveragePrice(orgId, priceCents, actor);
    successResponse(res, null, 'Overage price updated');
  }),

  topUpCredits: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId = getStrParam(req, 'id');
    const { credits, reason } = req.body as { credits: number; reason?: string };
    await platformAdminCreditsService.topUp(orgId, credits, actor, reason);
    successResponse(res, null, 'Credit top-up recorded');
  }),

  getUsageHistory: asyncHandler(async (req: Request, res: Response) => {
    const orgId  = getStrParam(req, 'id');
    const months = Number((req.query.months as string | undefined) ?? 12);
    const data = await platformAdminCreditsService.listUsageHistory(orgId, months);
    successResponse(res, data);
  }),

  listCharges: asyncHandler(async (req: Request, res: Response) => {
    const orgId = getStrParam(req, 'id');
    const { status, limit, offset } = req.query as Record<string, string | undefined>;
    const data = await platformAdminCreditsService.listCharges(orgId, {
      status: status as 'pending' | 'invoiced' | 'paid' | 'written_off' | undefined,
      limit:  Number(limit  ?? 100),
      offset: Number(offset ?? 0),
    });
    successResponse(res, data);
  }),

  writeOffCharge: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    const orgId    = getStrParam(req, 'id');
    const chargeId = getStrParam(req, 'chargeId');
    const reason   = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await platformAdminCreditsService.writeOffCharge(orgId, chargeId, actor, reason);
    successResponse(res, null, 'Charge written off');
  }),

  listAudit: asyncHandler(async (req: Request, res: Response) => {
    const { actorId, orgId, action, limit, offset } = req.query as Record<string, string | undefined>;
    const data = await platformAdminService.listAuditLog({
      actorId: actorId || undefined,
      orgId:   orgId   || undefined,
      action:  action  || undefined,
      limit:  Number(limit  ?? 50),
      offset: Number(offset ?? 0),
    });
    successResponse(res, data);
  }),
};
