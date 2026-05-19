import { db } from '../../config/database';
import { user, branchMembers, branches, organization, hrRecordsTable } from '@shared/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

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
    await runner.delete(user).where(and(eq(user.id, id), eq(user.orgId, orgId), isNotNull(user.inviteToken)));
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
      await this.updateUser(userId, userPatch, tx);
      await this.setBranchMembersActiveForUser(orgId, userId, true, tx);
    });
  },
};
