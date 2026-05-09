import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { inviteService } from './invite.service';
import { successResponse } from '../../utils/response';

export const inviteController = {
  send: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.send(req.body, req.orgId, req.branchId, req.orgRole);
    successResponse(res, data, 'Invite sent', 201);
  }),
  accept: asyncHandler(async (req: Request, res: Response) => {
    const invite = await inviteService.getByToken(req.query.token as string);
    successResponse(res, invite);
  }),
  acceptSubmit: asyncHandler(async (req: Request, res: Response) => {
    const user = await inviteService.acceptInvite(req.body.token, req.body);
    successResponse(res, user, 'Account created');
  }),
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await inviteService.listByOrg(req.orgId);
    successResponse(res, data);
  }),
  revoke: asyncHandler(async (req: Request, res: Response) => {
    await inviteService.revoke(req.params.id, req.orgId);
    successResponse(res, null, 'Invite revoked');
  }),
};
