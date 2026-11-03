import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getScope } from "../../utils/scope";
import { successResponse } from "../../utils/response";
import { departuresService } from "./departures.service";
import type { ListQuery, PatchCheckBody, SummaryQuery } from "./departures.validator";

export const departuresController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as unknown as ListQuery;
    const data = await departuresService.list(getScope(req), from, to);
    return successResponse(res, data, "Departures retrieved successfully");
  }),

  summary: asyncHandler(async (req: Request, res: Response) => {
    // validate() does not write parsed values back, so convert here.
    const { days } = req.query as unknown as SummaryQuery;
    const data = await departuresService.summary(getScope(req), days === undefined ? undefined : Number(days));
    return successResponse(res, data, "Departure summary retrieved successfully");
  }),

  setCheck: asyncHandler(async (req: Request, res: Response) => {
    const { key, value } = req.body as PatchCheckBody;
    const data = await departuresService.setCheck(getScope(req), String(req.params.bookingId), key, value);
    return successResponse(res, data, "Departure check updated successfully");
  }),
};
