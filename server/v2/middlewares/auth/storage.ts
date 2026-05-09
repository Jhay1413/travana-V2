import { user, type User, type UpsertUser } from "@shared/schema";
import { db } from "../../config/database";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.id, id));
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.email, email));
    return result;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.resetToken, token));
    return result;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { role, ...updateData } = userData;
    if (userData.email) {
      const existing = await this.getUserByEmail(userData.email);
      if (existing && existing.id !== userData.id) {
        const { id: _newId, ...safeUpdate } = updateData;
        const [result] = await db
          .update(user)
          .set({ ...safeUpdate, updatedAt: new Date() })
          .where(eq(user.id, existing.id))
          .returning();
        return result;
      }
    }
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

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [result] = await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
    return result;
  }
}

export const authStorage = new AuthStorage();
