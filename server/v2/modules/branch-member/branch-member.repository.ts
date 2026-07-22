import { db } from "../../config/database";
import { branchMembers, branches, user, userOrgRoles, type BranchMember } from "@shared/schema";
import { and, eq, isNull, notInArray } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type MemberWithUser = {
  user: {
    id: string;
    name: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    image: string | null;
    emailVerified: boolean;
    banned: boolean | null;
    orgRole: string | null;
  };
  branches: Array<{ branchId: string; branchName: string; orgRole: string; isActive: boolean }>;
};

export const branchMemberRepository = {
  async findActiveByUserId(userId: string) {
    const [result] = await db
      .select()
      .from(branchMembers)
      .where(and(eq(branchMembers.userId, userId), eq(branchMembers.isActive, true)))
      .limit(1);
    return result;
  },

  async findByUserAndBranch(userId: string, branchId: string): Promise<BranchMember | null> {
    const [row] = await db
      .select()
      .from(branchMembers)
      .where(and(eq(branchMembers.userId, userId), eq(branchMembers.branchId, branchId)))
      .limit(1);
    return row ?? null;
  },

  async findAllByOrg(orgId: string): Promise<BranchMember[]> {
    return db.select().from(branchMembers).where(eq(branchMembers.orgId, orgId));
  },

  async findByBranch(branchId: string): Promise<BranchMember[]> {
    return db.select().from(branchMembers).where(eq(branchMembers.branchId, branchId));
  },

  // Resolves a fallback owner for records an automation creates on an org's
  // behalf (e.g. an AI-created enquiry) that need a real user_id but have no
  // human agent assigned yet: prefer an active org_admin, else any active member.
  async findDefaultOwner(orgId: string): Promise<string | null> {
    const [admin] = await db
      .select({ userId: branchMembers.userId })
      .from(branchMembers)
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.orgRole, "org_admin"), eq(branchMembers.isActive, true)))
      .limit(1);
    if (admin) return admin.userId;
    const [member] = await db
      .select({ userId: branchMembers.userId })
      .from(branchMembers)
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.isActive, true)))
      .limit(1);
    return member?.userId ?? null;
  },

  async create(data: {
    orgId: string;
    branchId: string;
    userId: string;
    orgRole: string;
    isActive?: boolean;
  }, tx?: Tx): Promise<BranchMember> {
    const runner = tx ?? db;
    const [row] = await runner
      .insert(branchMembers)
      .values({ ...data, isActive: data.isActive ?? true })
      .returning();
    return row;
  },

  async setActiveForUser(orgId: string, userId: string, isActive: boolean, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .update(branchMembers)
      .set({ isActive })
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)));
  },

  async setRoleForUser(orgId: string, userId: string, orgRole: string, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .update(branchMembers)
      .set({ orgRole })
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)));
  },

  /**
   * Atomic: update both user.orgRole AND every branch_members.orgRole row for that user.
   * Used when an org admin changes a member's role — the two stores must stay in sync.
   *
   * Also clears out any stale `user_org_roles` junction row for a *different*
   * management role (org_admin/branch_manager/homeworker/social_media_manager/
   * referral_agent) so the auth-time union of junction rows + branch_members.orgRole
   * doesn't end up granting both the old and new role. The `agent` "also sells"
   * flag is preserved, unless the new role is `referral_agent`, which is
   * incompatible with every internal role including `agent`.
   */
  async setOrgRoleAtomic(orgId: string, userId: string, orgRole: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(user).set({ orgRole, updatedAt: new Date() }).where(eq(user.id, userId));
      await this.setRoleForUser(orgId, userId, orgRole, tx);

      const rolesToKeep = Array.from(new Set(orgRole === "referral_agent" ? [orgRole] : [orgRole, "agent"]));
      await tx
        .delete(userOrgRoles)
        .where(
          and(
            eq(userOrgRoles.userId, userId),
            eq(userOrgRoles.orgId, orgId),
            notInArray(userOrgRoles.role, rolesToKeep),
          ),
        );
    });
  },

  async removeAllForUser(orgId: string, userId: string, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .delete(branchMembers)
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)));
  },

  async removeFromBranch(branchId: string, userId: string): Promise<void> {
    await db
      .delete(branchMembers)
      .where(and(eq(branchMembers.branchId, branchId), eq(branchMembers.userId, userId)));
  },

  async listOrgMembersWithBranches(orgId: string): Promise<MemberWithUser[]> {
    const rows = await db
      .select({
        userId:       user.id,
        name:         user.name,
        email:        user.email,
        firstName:    user.firstName,
        lastName:     user.lastName,
        phoneNumber:  user.phoneNumber,
        image:        user.image,
        emailVerified: user.emailVerified,
        banned:       user.banned,
        userOrgRole:  user.orgRole,
        memberOrgRole: branchMembers.orgRole,
        memberActive: branchMembers.isActive,
        branchId:     branches.id,
        branchName:   branches.name,
      })
      .from(user)
      .leftJoin(branchMembers, and(eq(branchMembers.userId, user.id), eq(branchMembers.orgId, orgId)))
      .leftJoin(branches, eq(branches.id, branchMembers.branchId))
      .where(and(eq(user.orgId, orgId), isNull(user.inviteToken)));

    const byUser = new Map<string, MemberWithUser>();
    for (const r of rows) {
      const existing = byUser.get(r.userId) ?? {
        user: {
          id: r.userId,
          name: r.name,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          phoneNumber: r.phoneNumber,
          image: r.image,
          emailVerified: r.emailVerified,
          banned: r.banned,
          orgRole: r.userOrgRole,
        },
        branches: [],
      };
      if (r.branchId && r.branchName) {
        existing.branches.push({
          branchId: r.branchId,
          branchName: r.branchName,
          orgRole: r.memberOrgRole ?? '',
          isActive: r.memberActive ?? false,
        });
      }
      byUser.set(r.userId, existing);
    }
    return Array.from(byUser.values());
  },
};
