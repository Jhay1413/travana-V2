import { Router, Request, Response } from "express";
import { searchRepository } from "../repositories/search.repository";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      return successResponse(res, { clients: [], quotes: [], bookings: [] }, "Search results");
    }
    const results = await searchRepository.globalSearch(q, 15, 5);
    return successResponse(res, results, "Search results");
  })
);

export default router;
