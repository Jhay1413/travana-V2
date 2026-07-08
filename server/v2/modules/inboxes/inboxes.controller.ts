import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { inboxesService } from "./inboxes.service";

export const inboxesController = {
  // GET /api/v2/inboxes
  list: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await inboxesService.list(), "Inboxes retrieved");
  }),
};
