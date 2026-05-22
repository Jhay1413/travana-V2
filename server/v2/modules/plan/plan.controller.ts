import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { planService } from "./plan.service";
import { successResponse } from "../../utils/response";

export const planController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const data = await planService.list();
    successResponse(res, data);
  }),
};
