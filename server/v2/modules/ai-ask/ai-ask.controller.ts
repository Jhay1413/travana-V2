import { Request, Response } from 'express';
import { aiAskService } from './ai-ask.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getUserId } from '../../utils/get-user-id';

export const aiAskController = {
  ask: asyncHandler(async (req: Request, res: Response) => {
    const { question } = req.body || {};
    const answer = await aiAskService.ask(question);
    return successResponse(res, { answer }, 'Answer generated');
  }),

  saveToClient: asyncHandler(async (req: Request, res: Response) => {
    const { clientId, question, answer } = req.body || {};
    const agentId = getUserId(req);
    const note = await aiAskService.saveToClient({ clientId, question, answer, agentId });
    return successResponse(res, note, 'Note saved to client', 201);
  }),
};
