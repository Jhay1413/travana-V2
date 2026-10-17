import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getRequestActor } from '../../utils/request-actor';
import { orgMemberService } from './organization-member.service';
import { organizationMemberRemovalService } from './organization-member-removal.service';
import { organizationSeatService } from './organization-seat.service';
import type { MemberProfilePatch } from './organization.types';

function requireOrgId(req: Request): string {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return req.orgId;
}

function userIdParam(req: Request): string {
  return req.params.userId as string;
}

// validate() does not replace req.body, so every handler reads its fields explicitly.
export const orgMemberController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await orgMemberService.list(requireOrgId(req));
    successResponse(res, data);
  }),

  seats: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationSeatService.getUsage(requireOrgId(req));
    successResponse(res, data);
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const data = await orgMemberService.updateRole(
      requireOrgId(req), userIdParam(req), req.body.orgRole as string, getRequestActor(req),
    );
    successResponse(res, data, 'Role updated');
  }),

  setSuspended: asyncHandler(async (req: Request, res: Response) => {
    const suspended = req.body?.suspended === true;
    const notify = suspended && req.body?.notify === true;
    const data = await orgMemberService.setSuspended(
      requireOrgId(req), userIdParam(req), suspended, getRequestActor(req), notify,
    );
    successResponse(res, data, suspended ? 'Member suspended' : 'Member reactivated');
  }),

  assignBranch: asyncHandler(async (req: Request, res: Response) => {
    const data = await orgMemberService.assignToBranch(
      requireOrgId(req), userIdParam(req), req.body.branchId as string,
      req.body.orgRole as string | undefined, getRequestActor(req),
    );
    successResponse(res, data, 'Member assigned to branch', 201);
  }),

  unassignBranch: asyncHandler(async (req: Request, res: Response) => {
    await orgMemberService.unassignFromBranch(
      requireOrgId(req), userIdParam(req), req.params.branchId as string, getRequestActor(req),
    );
    successResponse(res, null, 'Member removed from branch');
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const patch: MemberProfilePatch = {};
    if (req.body.firstName !== undefined) patch.firstName = req.body.firstName as string;
    if (req.body.lastName !== undefined) patch.lastName = req.body.lastName as string;
    if (req.body.phoneNumber !== undefined) patch.phoneNumber = req.body.phoneNumber as string;
    const data = await orgMemberService.updateProfile(requireOrgId(req), userIdParam(req), patch, getRequestActor(req));
    successResponse(res, data, 'Profile updated');
  }),

  workload: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationMemberRemovalService.getWorkload(requireOrgId(req), userIdParam(req));
    successResponse(res, data);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const data = await organizationMemberRemovalService.remove(
      requireOrgId(req), userIdParam(req),
      { newOwnerId: req.body.newOwnerId as string | undefined },
      getRequestActor(req),
    );
    successResponse(res, data, 'Member removed');
  }),
};
