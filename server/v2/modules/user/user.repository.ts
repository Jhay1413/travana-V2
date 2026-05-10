import { db } from "../../config/database";
import { user, branchMembers, type User, type InsertUser } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Scope } from "../../utils/scope";

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

  async findAll(scope?: Scope): Promise<User[]> {
    if (!scope || scope.orgRole === "platform_admin") {
      return await db.select().from(user);
    }
    if (scope.orgRole === "org_admin") {
      return await db.select().from(user).where(eq(user.orgId, scope.orgId));
    }
    if (!scope.branchId) return [];
    const memberRows = await db
      .select({ userId: branchMembers.userId })
      .from(branchMembers)
      .where(and(eq(branchMembers.branchId, scope.branchId), eq(branchMembers.isActive, true)));
    const ids = memberRows.map(r => r.userId);
    if (ids.length === 0) return [];
    return await db.select().from(user).where(inArray(user.id, ids));
  },
};
