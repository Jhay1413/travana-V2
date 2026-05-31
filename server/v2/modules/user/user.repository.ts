import { db } from "../../config/database";
import { user, branchMembers, type User, type InsertUser, type UpsertUser } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Scope } from "../../utils/scope";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";

export const userRepository = {
  async findById(id: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return result;
  },

  /**
   * Lightweight lookup used by auth/role middleware. Returns just the fields
   * needed to gate a request (role + display name); avoids pulling the full
   * user row when the caller only needs to authorise.
   */
  async findRoleAndNameById(id: string): Promise<{ name: string | null; role: string | null } | undefined> {
    const [result] = await db
      .select({ name: user.name, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return result;
  },

  async findRoleById(id: string): Promise<{ role: string | null } | undefined> {
    const [result] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return result;
  },

  /** Lightweight roster used by mention/notification fan-out. */
  async findAllIdsAndNames(): Promise<Array<{ id: string; name: string | null }>> {
    return db.select({ id: user.id, name: user.name }).from(user);
  },

  async findAllIdsNamesAndRoles(): Promise<Array<{ id: string; name: string | null; role: string | null }>> {
    return db.select({ id: user.id, name: user.name, role: user.role }).from(user);
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return result;
  },

  async findByVerificationToken(token: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.verificationToken, token)).limit(1);
    return result;
  },

  async findByResetToken(token: string): Promise<User | undefined> {
    const [result] = await db.select().from(user).where(eq(user.resetToken, token)).limit(1);
    return result;
  },

  /**
   * Auth-flow upsert: if a user already exists with the same email but a
   * different id (typical OAuth merge), update by email; otherwise insert and
   * fall back to id-based on-conflict update. The role field is preserved on
   * the existing row to avoid privilege escalation via the OAuth payload.
   */
  async upsertByIdOrEmail(userData: UpsertUser): Promise<User> {
    const { role: _role, ...updateData } = userData;
    if (userData.email) {
      const existing = await this.findByEmail(userData.email);
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
        set: { ...updateData, updatedAt: new Date() },
      })
      .returning();
    return result;
  },

  async updatePartial(id: string, data: Partial<User>): Promise<User | undefined> {
    const [result] = await db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
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

  /**
   * Scoped user roster. With `salesAgentsOnly`, only sales agents (the `agent`
   * role) are returned, so non-selling roles never appear as assignable deal
   * owners or in agent filters. A branch manager who also sells holds the
   * `agent` role too, so they're kept. Without the flag, the full scoped roster
   * is returned (e.g. for @-mentions, chat, ticket assignment).
   */
  async findAll(scope?: Scope, opts?: { salesAgentsOnly?: boolean }): Promise<User[]> {
    const salesOnly = opts?.salesAgentsOnly === true;

    if (!scope || scope.orgRole === "platform_admin") {
      if (!salesOnly) return await db.select().from(user);
      const agentIds = await userOrgRolesRepository.findSalesAgentUserIds();
      if (agentIds.length === 0) return [];
      return await db.select().from(user).where(inArray(user.id, agentIds));
    }
    if (scope.orgRole === "org_admin") {
      if (!salesOnly) return await db.select().from(user).where(eq(user.orgId, scope.orgId));
      const agentIds = await userOrgRolesRepository.findSalesAgentUserIds({ orgId: scope.orgId });
      if (agentIds.length === 0) return [];
      return await db
        .select()
        .from(user)
        .where(and(eq(user.orgId, scope.orgId), inArray(user.id, agentIds)));
    }
    if (!scope.branchId) return [];
    const memberRows = await db
      .select({ userId: branchMembers.userId })
      .from(branchMembers)
      .where(and(eq(branchMembers.branchId, scope.branchId), eq(branchMembers.isActive, true)));
    let ids = memberRows.map(r => r.userId);
    if (salesOnly) {
      const agentSet = new Set(
        await userOrgRolesRepository.findSalesAgentUserIds({ orgId: scope.orgId, branchId: scope.branchId }),
      );
      ids = ids.filter(id => agentSet.has(id));
    }
    if (ids.length === 0) return [];
    return await db.select().from(user).where(inArray(user.id, ids));
  },
};
