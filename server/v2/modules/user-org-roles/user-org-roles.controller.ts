import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';
import { userOrgRolesService, type RoleChangeActor } from './user-org-roles.service';

function buildActor(req: Request): RoleChangeActor {
  const userId = getUserId(req);
  if (!userId) throw new AppError('Unauthorized', 401);
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return {
    userId,
    ipAddress: fwd || req.socket.remoteAddress || null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
  };
}

// The self-service "also sell" toggle is gated to users who are already at
// least branch_manager. We don't want any agent silently elevating themselves.
const SELL_ELIGIBLE_ROLES = new Set(['org_admin', 'branch_manager', 'platform_admin']);

function assertSellEligible(req: Request): void {
  const roles = req.orgRoles ?? [];
  if (!roles.some((r) => SELL_ELIGIBLE_ROLES.has(r))) {
    throw new AppError(
      'Only org admins and branch managers can toggle the sales agent role on themselves',
      403,
    );
  }
}

export const userOrgRolesController = {
  /** Return MY roles in the current org. */
  listMyRoles: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) throw new AppError('Unauthorized', 401);
    if (!req.orgId) throw new AppError('No organisation context', 403);
    const roles = await userOrgRolesService.listForUser(userId, req.orgId);
    successResponse(res, { roles });
  }),

  /** Self-service: add the `agent` role to the current user. */
  startSelling: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    if (!req.orgId) throw new AppError('No organisation context', 403);
    assertSellEligible(req);
    await userOrgRolesService.addRole(actor.userId, req.orgId, 'agent', actor);
    successResponse(res, null, 'Sales agent role added');
  }),

  /** Self-service: remove the `agent` role from the current user. */
  stopSelling: asyncHandler(async (req: Request, res: Response) => {
    const actor = buildActor(req);
    if (!req.orgId) throw new AppError('No organisation context', 403);
    assertSellEligible(req);
    await userOrgRolesService.removeRole(actor.userId, req.orgId, 'agent', actor);
    successResponse(res, null, 'Sales agent role removed');
  }),
};
