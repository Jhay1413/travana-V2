import { db } from "../../config/database";
import { branchMembers } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export const branchMemberRepository = {
  async findActiveByUserId(userId: string) {
    const [result] = await db
      .select()
      .from(branchMembers)
      .where(and(eq(branchMembers.userId, userId), eq(branchMembers.isActive, true)))
      .limit(1);
    return result;
  },
};
