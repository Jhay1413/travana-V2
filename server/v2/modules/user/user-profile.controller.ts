import { Request, Response } from "express";
import { userProfileService } from "./user-profile.service";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getUserId } from "../../utils/get-user-id";
import { getScope } from "../../utils/scope";

export const userProfileController = {
  getMine: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const profile = await userProfileService.getMyProfile(userId);
    return successResponse(res, profile, "Profile retrieved");
  }),

  getByUserId: asyncHandler(async (req: Request, res: Response) => {
    const targetUserId = req.params.userId as string;
    const profile = await userProfileService.getProfile(targetUserId, getScope(req));
    return successResponse(res, profile, "Profile retrieved");
  }),

  saveMine: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { bio, extendedBio, location, specialisation, certifications, coverImage } = req.body;
    const profile = await userProfileService.upsertMyProfile(userId, {
      bio, extendedBio, location, specialisation, certifications, coverImage,
    });
    return successResponse(res, profile, "Profile saved");
  }),
};
