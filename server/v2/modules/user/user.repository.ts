import { db } from "../../config/database";
import { user, type User, type InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

export const userRepository = {
  async findById(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return result;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return result;
  },

  async create(userData: InsertUser): Promise<User> {
    const [result] = await db.insert(user).values(userData).returning();
    return result;
  },

  async update(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db.update(user).set({ ...userData, updatedAt: new Date() }).where(eq(user.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(user).where(eq(user.id, id));
  },

  async findAll(): Promise<User[]> {
    return await db.select().from(user);
  },
};
