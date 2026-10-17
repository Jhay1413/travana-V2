import { db } from '../../config/database';
import { user, branchMembers, branches, organization, hrRecordsTable, userOrgRoles } from '@shared/schema';
import { and, eq, isNotNull, notExists } from 'drizzle-orm';
import { AppError } from '../../utils/error-handler';
import { placeholderNameForEmail } from '../../utils/homeworker-name';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PendingInviteRow {
  userId:           string;
  email:            string;
  orgRole:          string | null;
  invitedAt:        Date | null;
  inviteTokenExpiry: Date | null;
  invitedBy:        string | null;
  branchId:         string | null;
  branchName:       string | null;
}

export const inviteRepository = {
  async findPendingByOrg(orgId: string): Promise<PendingInviteRow[]> {
    const rows = await db
      .select({
        userId:           user.id,
        email:            user.email,
        orgRole:          user.orgRole,
        invitedAt:        user.invitedAt,
        inviteTokenExpiry: user.inviteTokenExpiry,
        invitedBy:        user.invitedBy,
        branchId:         branches.id,
        branchName:       branches.name,
      })
      .from(user)
      .leftJoin(branchMembers, and(eq(branchMembers.userId, user.id), eq(branchMembers.orgId, orgId)))
      .leftJoin(branches, eq(branches.id, branchMembers.branchId))
      .where(and(eq(user.orgId, orgId), isNotNull(user.inviteToken)));
    return rows;
  },

  async findByEmail(email: string) {
    const [row] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return row ?? null;
  },

  async findByToken(token: string) {
    const [row] = await db.select().from(user).where(eq(user.inviteToken, token)).limit(1);
    return row ?? null;
  },

  async findById(id: string) {
    const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return row ?? null;
  },

  async createPendingUser(values: typeof user.$inferInsert, tx?: Tx) {
    const runner = tx ?? db;
    const [row] = await runner.insert(user).values(values).returning();
    return row;
  },

  async updateUser(id: string, values: Partial<typeof user.$inferInsert>, tx?: Tx) {
    const runner = tx ?? db;
    const [row] = await runner.update(user).set(values).where(eq(user.id, id)).returning();
    return row ?? null;
  },

  async createBranchMember(values: typeof branchMembers.$inferInsert, tx?: Tx) {
    const runner = tx ?? db;
    const [row] = await runner.insert(branchMembers).values(values).returning();
    return row;
  },

  async setBranchMembersActiveForUser(orgId: string, userId: string, isActive: boolean, tx?: Tx) {
    const runner = tx ?? db;
    await runner
      .update(branchMembers)
      .set({ isActive })
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)));
  },

  async deletePendingUser(id: string, orgId: string, tx?: Tx) {
    const runner = tx ?? db;
    // branchMembers cascade-delete on user delete via FK
    return runner
      .delete(user)
      .where(and(eq(user.id, id), eq(user.orgId, orgId), isNotNull(user.inviteToken)))
      .returning({ id: user.id });
  },

  /** The homeworker branch this user owns, if any. */
  async findOwnedHomeworkerBranch(userId: string, orgId: string) {
    const [row] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.ownerUserId, userId),
          eq(branches.organizationId, orgId),
          eq(branches.branchType, 'homeworker'),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * Atomic: revoke an unaccepted homeworker invite. The user goes first
   * (memberships, roles and the HR record cascade), then the now-empty branch.
   * Guarded against a race (the invite accepted or another member added between
   * the service's read and this write): exactly one pending user row must be
   * deleted and no membership may still reference the branch, otherwise 409 and
   * the transaction rolls back.
   */
  async deletePendingUserWithBranch(userId: string, orgId: string, branchId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const deletedUsers = await this.deletePendingUser(userId, orgId, tx);
      if (deletedUsers.length !== 1) {
        throw new AppError('This invite can no longer be revoked; it may have been accepted', 409);
      }
      const deletedBranches = await tx
        .delete(branches)
        .where(
          and(
            eq(branches.id, branchId),
            eq(branches.organizationId, orgId),
            eq(branches.branchType, 'homeworker'),
            notExists(tx.select({ id: branchMembers.id }).from(branchMembers).where(eq(branchMembers.branchId, branchId))),
          ),
        )
        .returning({ id: branches.id });
      if (deletedBranches.length !== 1) {
        throw new AppError('Homeworker branch is no longer empty; archive the homeworker instead', 409);
      }
    });
  },

  async getOrgName(orgId: string): Promise<string | null> {
    const [row] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId)).limit(1);
    return row?.name ?? null;
  },

  async findBranchMembershipForUser(orgId: string, userId: string) {
    const [row] = await db
      .select({ branchId: branchMembers.branchId, isActive: branchMembers.isActive })
      .from(branchMembers)
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  /**
   * Atomic: create the pending user record AND the inactive branch membership.
   * Both succeed or both rollback.
   */
  async createPendingUserWithBranchMembership(
    userValues: typeof user.$inferInsert,
    branchMember: typeof branchMembers.$inferInsert,
  ): Promise<typeof user.$inferSelect> {
    return db.transaction(async (tx) => {
      const newUser = await this.createPendingUser(userValues, tx);
      await this.createBranchMember(branchMember, tx);

      // Multi-role: seed the junction table with the invited user's role.
      if (userValues.orgRole && newUser.orgId) {
        await tx
          .insert(userOrgRoles)
          .values({ userId: newUser.id, orgId: newUser.orgId, role: userValues.orgRole })
          .onConflictDoNothing({ target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role] });
      }

      await tx
        .insert(hrRecordsTable)
        .values({ orgId: branchMember.orgId, userId: newUser.id })
        .onConflictDoNothing({ target: hrRecordsTable.userId });
      return newUser;
    });
  },

  /**
   * Atomic: finalise an accepted invite — fill in the user fields and flip
   * their branch_members row to active.
   */
  async finaliseAcceptedInvite(
    userId: string,
    orgId: string,
    userPatch: Partial<typeof user.$inferInsert>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const updated = await this.updateUser(userId, userPatch, tx);
      await this.setBranchMembersActiveForUser(orgId, userId, true, tx);

      // A homeworker's branch carries their name once they have accepted, but only
      // while it still has the placeholder generated at invite time (a displayName
      // chosen by the admin is preserved).
      const branchName = typeof userPatch.name === 'string' ? userPatch.name.trim() : '';
      if (branchName && updated?.email) {
        await tx
          .update(branches)
          .set({ name: branchName })
          .where(
            and(
              eq(branches.ownerUserId, userId),
              eq(branches.organizationId, orgId),
              eq(branches.branchType, 'homeworker'),
              eq(branches.name, placeholderNameForEmail(updated.email)),
            ),
          );
      }
    });
  },
};
