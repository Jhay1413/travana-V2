import { Router, Request, Response } from "express";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { getUserId } from "../utils/get-user-id";
import { userProfileRepository } from "../repositories/userProfile.repository";

const router = Router();
router.use(isAuthenticated);

router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const row = await userProfileRepository.findByUserId(userId);
    return successResponse(res, row, "Profile retrieved");
  })
);

router.get(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const row = await userProfileRepository.findByUserId(req.params.userId);
    return successResponse(res, row, "Profile retrieved");
  })
);

router.put(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { bio, extendedBio, location, specialisation, certifications, coverImage } = req.body;
    const row = await userProfileRepository.upsert(userId, {
      bio,
      extendedBio,
      location,
      specialisation,
      certifications,
      coverImage,
    });
    return successResponse(res, row, "Profile saved");
  })
);

export default router;
