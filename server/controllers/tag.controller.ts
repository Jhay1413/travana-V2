import { Request, Response } from "express";
import { tagService } from "../services/tag.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const tagController = {
  getAllTags: asyncHandler(async (req: Request, res: Response) => {
    const tags = await tagService.getAllTags();
    return successResponse(res, tags, "Tags retrieved successfully");
  }),

  searchTags: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
      const tags = await tagService.getAllTags();
      return successResponse(res, tags, "All tags retrieved");
    }
    const tags = await tagService.searchTags(query);
    return successResponse(res, tags, "Tags searched successfully");
  }),
};
