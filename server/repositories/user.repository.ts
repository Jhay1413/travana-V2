import { db } from "../config/database";
import { users, type User, type InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

export const userRepository = {
  async findById(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result;
  },

  async create(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  },

  async update(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },

  async findAll(): Promise<User[]> {
    return await db.select().from(users);
  },
};
