import { Router, Request, Response } from "express";
import { db } from "../config/database";
import { userProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { getUserId } from "../utils/get-user-id";

const router = Router();
router.use(isAuthenticated);

router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return successResponse(res, row || null, "Profile retrieved");
  })
);

router.get(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, req.params.userId));
    return successResponse(res, row || null, "Profile retrieved");
  })
);

router.put(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { bio, extendedBio, location, specialisation, certifications, coverImage } = req.body;
    const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    let row;
    if (existing) {
      [row] = await db
        .update(userProfiles)
        .set({
          bio: bio ?? existing.bio,
          extendedBio: extendedBio ?? existing.extendedBio,
          location: location ?? existing.location,
          specialisation: specialisation ?? existing.specialisation,
          certifications: certifications ?? existing.certifications,
          coverImage: coverImage ?? existing.coverImage,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
    } else {
      [row] = await db
        .insert(userProfiles)
        .values({
          userId,
          bio: bio || null,
          extendedBio: extendedBio || null,
          location: location || null,
          specialisation: specialisation || null,
          certifications: certifications || null,
          coverImage: coverImage || null,
        })
        .returning();
    }
    return successResponse(res, row, "Profile saved");
  })
);

export default router;
