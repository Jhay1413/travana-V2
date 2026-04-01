import { db } from "../config/database";
import { user, userProfiles, type User } from "@shared/schema";
import { eq } from "drizzle-orm";

interface CreateAgentData {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  password: string;
  location: string;
  bio: string | null;
}

export const registrationRepository = {
  async findByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return result;
  },

  async createAgentWithProfile(data: CreateAgentData): Promise<User> {
    const { location, bio, ...userData } = data;

    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(user)
        .values(userData)
        .returning();

      await tx.insert(userProfiles).values({
        userId: newUser.id,
        location,
        bio,
      });

      return newUser;
    });
  },
};
