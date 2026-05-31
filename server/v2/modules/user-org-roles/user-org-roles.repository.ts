import { db } from '../../config/database';
import { userOrgRoles, branchMembers, type UserOrgRole, type InsertUserOrgRole } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The org-role string that marks a user as a sales agent. */
const SALES_AGENT_ROLE = 'agent';

export const userOrgRolesRepository = {
  /**
   * User IDs of everyone who is a sales agent — i.e. holds the `agent` role,
   * either granted in the `user_org_roles` junction or as their active branch
   * membership role. A user who is a branch manager AND a sales agent has an
   * `agent` row too, so they are included. Used to keep agent pickers, deal
   * filters and leaderboards limited to people who actually sell.
   *
   * Scope it as tightly as the caller can: `branchId` restricts the membership
   * side to one branch, `orgId` restricts both sides to one org. With neither
   * (platform-admin context) it returns sales agents across all orgs.
   */
  async findSalesAgentUserIds(opts?: { orgId?: string | null; branchId?: string | null }): Promise<string[]> {
    const orgId = opts?.orgId ?? null;
    const branchId = opts?.branchId ?? null;

    const junctionConds = [eq(userOrgRoles.role, SALES_AGENT_ROLE)];
    if (orgId) junctionConds.push(eq(userOrgRoles.orgId, orgId));

    const memberConds = [eq(branchMembers.orgRole, SALES_AGENT_ROLE), eq(branchMembers.isActive, true)];
    if (branchId) memberConds.push(eq(branchMembers.branchId, branchId));
    else if (orgId) memberConds.push(eq(branchMembers.orgId, orgId));

    const [junctionRows, memberRows] = await Promise.all([
      db.select({ userId: userOrgRoles.userId }).from(userOrgRoles).where(and(...junctionConds)),
      db.select({ userId: branchMembers.userId }).from(branchMembers).where(and(...memberConds)),
    ]);

    const ids = new Set<string>();
    for (const r of junctionRows) ids.add(r.userId);
    for (const r of memberRows) ids.add(r.userId);
    return Array.from(ids);
  },

  /** Returns the full junction rows for a (user, org). */
  async findByUserAndOrg(userId: string, orgId: string): Promise<UserOrgRole[]> {
    return db
      .select()
      .from(userOrgRoles)
      .where(and(eq(userOrgRoles.userId, userId), eq(userOrgRoles.orgId, orgId)));
  },

  /** Convenience: just the role strings for a (user, org). */
  async findRolesByUserAndOrg(userId: string, orgId: string): Promise<string[]> {
    const rows = await db
      .select({ role: userOrgRoles.role })
      .from(userOrgRoles)
      .where(and(eq(userOrgRoles.userId, userId), eq(userOrgRoles.orgId, orgId)));
    return rows.map((r) => r.role);
  },

  /** Insert a (user, org, role) row. Idempotent — duplicates are ignored. */
  async addRole(
    input: InsertUserOrgRole,
    tx?: Tx,
  ): Promise<void> {
    const runner = tx ?? db;
    await runner
      .insert(userOrgRoles)
      .values(input)
      .onConflictDoNothing({
        target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role],
      });
  },

  /** Remove a single role for a (user, org). No-op if the row doesn't exist. */
  async removeRole(userId: string, orgId: string, role: string, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .delete(userOrgRoles)
      .where(
        and(
          eq(userOrgRoles.userId, userId),
          eq(userOrgRoles.orgId, orgId),
          eq(userOrgRoles.role, role),
        ),
      );
  },
};
