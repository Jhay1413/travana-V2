import { db } from "../config/database";
import { userProfiles, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { eq } from "drizzle-orm";

export const userProfileRepository = {
  async findByUserId(userId: string): Promise<UserProfile | null> {
    const [row] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return row ?? null;
  },

  async upsert(
    userId: string,
    data: Omit<Partial<InsertUserProfile>, "userId">,
  ): Promise<UserProfile> {
    const existing = await this.findByUserId(userId);

    if (existing) {
      const [row] = await db
        .update(userProfiles)
        .set({
          bio: data.bio ?? existing.bio,
          extendedBio: data.extendedBio ?? existing.extendedBio,
          location: data.location ?? existing.location,
          specialisation: data.specialisation ?? existing.specialisation,
          certifications: data.certifications ?? existing.certifications,
          coverImage: data.coverImage ?? existing.coverImage,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return row;
    }

    const [row] = await db
      .insert(userProfiles)
      .values({
        userId,
        bio: data.bio || null,
        extendedBio: data.extendedBio || null,
        location: data.location || null,
        specialisation: data.specialisation || null,
        certifications: data.certifications || null,
        coverImage: data.coverImage || null,
      })
      .returning();
    return row;
  },
};
