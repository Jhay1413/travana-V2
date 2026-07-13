import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { knowledgeBaseService } from "./knowledge-base.service";
import type { KbCreateInput, KbUpdateInput } from "./knowledge-base.repository";

export const knowledgeBaseController = {
  // GET /api/v2/knowledge-base
  list: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await knowledgeBaseService.list(getScope(req).orgId), "Knowledge base entries");
  }),

  // POST /api/v2/knowledge-base
  create: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const row = await knowledgeBaseService.create(scope.orgId, req.body as KbCreateInput, scope.userId);
    return successResponse(res, row, "Entry created", 201);
  }),

  // PUT /api/v2/knowledge-base/:id
  update: asyncHandler(async (req: Request, res: Response) => {
    const row = await knowledgeBaseService.update(getScope(req).orgId, req.params.id as string, req.body as KbUpdateInput);
    return successResponse(res, row, "Entry updated");
  }),

  // DELETE /api/v2/knowledge-base/:id
  remove: asyncHandler(async (req: Request, res: Response) => {
    await knowledgeBaseService.remove(getScope(req).orgId, req.params.id as string);
    return successResponse(res, { ok: true }, "Entry deleted");
  }),
};
