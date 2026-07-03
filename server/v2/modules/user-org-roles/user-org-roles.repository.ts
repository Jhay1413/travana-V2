import { db } from '../../config/database';
import { userOrgRoles, branchMembers, user, type UserOrgRole, type InsertUserOrgRole } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The org-role string that marks a user as a sales agent. */
const SALES_AGENT_ROLE = 'agent';

/** Support role that should not appear in agent pickers, leaderboards or stats. */
const SOCIAL_MEDIA_ROLE = 'social_media_manager';

/** Operational roles — a user holding any of these is a real team member. */
const OPERATIONAL_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker'];

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

  /**
   * User IDs whose ONLY role is `social_media_manager` (i.e. they hold no
   * operational role like agent/homeworker/branch_manager/org_admin). These are
   * excluded from agent pickers, target lists, leaderboards and performance
   * stats. A social media manager who is ALSO an agent keeps their operational
   * role and is NOT returned here, so they still show up where appropriate.
   */
  async findSocialOnlyUserIds(opts?: { orgId?: string | null; branchId?: string | null }): Promise<string[]> {
    const orgId = opts?.orgId ?? null;
    const branchId = opts?.branchId ?? null;

    const memberConds = [eq(branchMembers.isActive, true)];
    if (branchId) memberConds.push(eq(branchMembers.branchId, branchId));
    else if (orgId) memberConds.push(eq(branchMembers.orgId, orgId));

    const junctionBase = db.select({ userId: userOrgRoles.userId, role: userOrgRoles.role }).from(userOrgRoles);
    const [junctionRows, memberRows] = await Promise.all([
      orgId ? junctionBase.where(eq(userOrgRoles.orgId, orgId)) : junctionBase,
      db.select({ userId: branchMembers.userId, role: branchMembers.orgRole }).from(branchMembers).where(and(...memberConds)),
    ]);

    const rolesByUser = new Map<string, Set<string>>();
    const add = (userId: string, role: string) => {
      let set = rolesByUser.get(userId);
      if (!set) { set = new Set(); rolesByUser.set(userId, set); }
      set.add(role);
    };
    for (const r of junctionRows) add(r.userId, r.role);
    for (const r of memberRows) add(r.userId, r.role);

    const result: string[] = [];
    rolesByUser.forEach((roles, userId) => {
      if (roles.has(SOCIAL_MEDIA_ROLE) && !OPERATIONAL_ROLES.some((r) => roles.has(r))) {
        result.push(userId);
      }
    });
    return result;
  },

  /**
   * User IDs who are SUSPENDED in the org — they have branch memberships but
   * none that are active. Suspending a member flips every one of their
   * `branch_members.is_active` rows to false (see branchMemberRepository
   * .setActiveForUser), so "has memberships, none active" == suspended.
   * Suspended users must be excluded from all reports/leaderboards.
   *
   * Returns an empty set when `orgId` is null (platform-admin cross-org
   * context) — suspension is an org-scoped concept.
   */
  async findSuspendedUserIds(opts?: { orgId?: string | null }): Promise<Set<string>> {
    const orgId = opts?.orgId ?? null;
    if (!orgId) return new Set();

    const [inactiveRows, activeRows] = await Promise.all([
      db.select({ userId: branchMembers.userId }).from(branchMembers)
        .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.isActive, false))),
      db.select({ userId: branchMembers.userId }).from(branchMembers)
        .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.isActive, true))),
    ]);

    const active = new Set(activeRows.map((r) => r.userId));
    const suspended = new Set<string>();
    for (const r of inactiveRows) if (!active.has(r.userId)) suspended.add(r.userId);
    return suspended;
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

  /** Fetch the global `role` column from the `user` table (e.g. to check for `platform_admin`). */
  async findUserRole(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.role ?? null;
  },

  /** Update the legacy `orgRole` column on the `user` table. */
  async updateUserOrgRole(userId: string, orgRole: string): Promise<void> {
    await db
      .update(user)
      .set({ orgRole, updatedAt: new Date() })
      .where(eq(user.id, userId));
  },
};
