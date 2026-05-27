import { db } from '../../config/database';
import { userOrgRoles, type UserOrgRole, type InsertUserOrgRole } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const userOrgRolesRepository = {
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
