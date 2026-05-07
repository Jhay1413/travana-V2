import { Router, Request, Response } from "express";
import { aiAskService } from "../services/ai-ask.service";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { getUserId } from "../utils/get-user-id";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";

const router = Router();
router.use(isAuthenticated);

router.post(
  "/ask",
  asyncHandler(async (req: Request, res: Response) => {
    const { question } = req.body || {};
    const answer = await aiAskService.ask(question);
    return successResponse(res, { answer }, "Answer generated");
  })
);

router.post(
  "/ask/save",
  asyncHandler(async (req: Request, res: Response) => {
    const { clientId, question, answer } = req.body || {};
    const agentId = getUserId(req);
    const note = await aiAskService.saveToClient({ clientId, question, answer, agentId });
    return successResponse(res, note, "Note saved to client", 201);
  })
);

export default router;
