import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../../utils/get-user-id';
import { inviteService, type ActorContext } from './invite.service';

function actorFromRequest(req: Request): ActorContext {
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return {
    orgId:    req.orgId,
    userId:   getUserId(req),
    orgRole:  req.orgRole ?? '',
    branchId: req.branchId ?? null,
  };
}

export const inviteController = {
  send: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.send(req.body, actorFromRequest(req));
    successResponse(res, data, 'Invite sent', 201);
  }),
  resend: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.resend(req.params.userId as string, actorFromRequest(req));
    successResponse(res, data, 'Invite re-sent');
  }),
  accept: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.getByToken(req.query.token as string);
    successResponse(res, data);
  }),
  acceptSubmit: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.acceptInvite(req.body);
    successResponse(res, data, 'Account created — you can now sign in');
  }),
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.listByOrg(actorFromRequest(req));
    successResponse(res, data);
  }),
  revoke: asyncHandler(async (req: Request, res: Response) => {
    await inviteService.revoke(req.params.userId as string, actorFromRequest(req));
    successResponse(res, null, 'Invite revoked');
  }),
};
