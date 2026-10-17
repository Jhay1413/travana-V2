import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getScope } from '../../utils/scope';
import { getRequestActor } from '../../utils/request-actor';
import { requestOrigin } from '../../utils/link-base';
import { homeworkerService } from './homeworker.service';
import type { HomeworkerActor } from './homeworker.types';

function requireOrgId(req: Request): string {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return req.orgId;
}

function actorFromRequest(req: Request): HomeworkerActor {
  const scope = getScope(req);
  return {
    orgId: requireOrgId(req),
    userId: scope.userId,
    orgRole: scope.orgRole,
    orgRoles: scope.orgRoles,
  };
}

export const homeworkerController = {
  invite: asyncHandler(async (req: Request, res: Response) => {
    const actor = { ...actorFromRequest(req), requestActor: getRequestActor(req) };
    const data = await homeworkerService.invite(req.body, actor, requestOrigin(req));
    successResponse(res, data, 'Homeworker invited', 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const includeArchived = req.query.includeArchived === 'true';
    const data = await homeworkerService.list(requireOrgId(req), includeArchived);
    successResponse(res, data);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const data = await homeworkerService.getMine(requireOrgId(req), getScope(req).userId);
    successResponse(res, data);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await homeworkerService.update(req.params.branchId as string, requireOrgId(req), req.body);
    successResponse(res, data, 'Homeworker updated');
  }),

  statement: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await homeworkerService.getStatement(actorFromRequest(req), req.params.branchId as string, from, to);
    successResponse(res, data);
  }),

  myStatement: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const data = await homeworkerService.getMyStatement(actorFromRequest(req), from, to);
    successResponse(res, data);
  }),

  finaliseStatement: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.body as { from: string; to: string };
    const data = await homeworkerService.finaliseStatement(actorFromRequest(req), req.params.branchId as string, from, to);
    successResponse(res, data, 'Statement finalised', 201);
  }),

  archive: asyncHandler(async (req: Request, res: Response) => {
    const data = await homeworkerService.archive(req.params.branchId as string, requireOrgId(req));
    successResponse(res, data, 'Homeworker archived');
  }),
};
