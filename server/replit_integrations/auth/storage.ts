import { user, type User, type UpsertUser } from "@shared/schema";
import { db } from "../../config/database";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.id, id));
    return result;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { role, ...updateData } = userData;
    const [result] = await db
      .insert(user)
      .values(userData)
      .onConflictDoUpdate({
        target: user.id,
        set: {
          ...updateData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }
}

export const authStorage = new AuthStorage();
