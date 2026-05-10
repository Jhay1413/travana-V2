import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../../utils/get-user-id';
import { orgMemberService } from './organization-member.service';

function requireOrgId(req: Request): string {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return req.orgId;
}

export const orgMemberController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await orgMemberService.list(requireOrgId(req));
    successResponse(res, data);
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await orgMemberService.updateRole(orgId, req.params.userId as string, req.body.orgRole, getUserId(req));
    successResponse(res, data, 'Role updated');
  }),

  setSuspended: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const suspended = req.body?.suspended === true;
    const data = await orgMemberService.setSuspended(orgId, req.params.userId as string, suspended, getUserId(req));
    successResponse(res, data, suspended ? 'Member suspended' : 'Member reactivated');
  }),

  assignBranch: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await orgMemberService.assignToBranch(orgId, req.params.userId as string, req.body.branchId, req.body.orgRole);
    successResponse(res, data, 'Member assigned to branch', 201);
  }),

  unassignBranch: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    await orgMemberService.unassignFromBranch(orgId, req.params.userId as string, req.params.branchId as string);
    successResponse(res, null, 'Member removed from branch');
  }),
};
