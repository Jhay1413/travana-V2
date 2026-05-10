import { db } from "../../config/database";
import { userProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ProfileUpsertInput {
  bio?: string | null;
  extendedBio?: string | null;
  location?: string | null;
  specialisation?: string | null;
  certifications?: string | null;
  coverImage?: string | null;
}

export const userProfileRepository = {
  async findByUserId(userId: string) {
    const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return row;
  },

  async upsert(userId: string, input: ProfileUpsertInput) {
    const existing = await this.findByUserId(userId);
    if (existing) {
      const [row] = await db
        .update(userProfiles)
        .set({
          bio: input.bio ?? existing.bio,
          extendedBio: input.extendedBio ?? existing.extendedBio,
          location: input.location ?? existing.location,
          specialisation: input.specialisation ?? existing.specialisation,
          certifications: input.certifications ?? existing.certifications,
          coverImage: input.coverImage ?? existing.coverImage,
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
        bio: input.bio ?? null,
        extendedBio: input.extendedBio ?? null,
        location: input.location ?? null,
        specialisation: input.specialisation ?? null,
        certifications: input.certifications ?? null,
        coverImage: input.coverImage ?? null,
      })
      .returning();
    return row;
  },
};
