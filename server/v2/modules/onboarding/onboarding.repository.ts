import { db } from "../../config/database";
import { organization, branches, branchMembers, user } from "@shared/schema";
import type { InsertOrganization, InsertBranch, InsertUser, InsertBranchMember } from "@shared/schema";

export interface OnboardingAgentInput {
  userValues: InsertUser;
  branchMember: InsertBranchMember;
}

export interface OnboardingSignupInput {
  organization: InsertOrganization;
  branchInputs: InsertBranch[];
  ownerUser: InsertUser;
  ownerBranchMemberRoleAndActive: { orgRole: string; isActive: boolean };
  agents: Array<{
    user: InsertUser;
    /** Index into branchInputs (defaults to 0). */
    branchIndex?: number;
    branchMemberRoleAndActive: { orgRole: string; isActive: boolean };
  }>;
}

export interface OnboardingSignupResult {
  orgId: string;
  ownerId: string;
  branchIds: string[];
}

export const onboardingRepository = {
  /**
   * Atomic agency signup: create the organisation, all initial branches, the
   * owner user + their branch_member row, and every agent user + branch_member.
   * Either the whole signup commits or none of it does.
   *
   * Caller is responsible for hashing passwords and generating verification
   * tokens before calling.
   */
  async signupAgency(input: OnboardingSignupInput): Promise<OnboardingSignupResult> {
    return db.transaction(async (tx) => {
      const [org] = await tx.insert(organization).values(input.organization).returning();

      const branchIds: string[] = [];
      for (let i = 0; i < input.branchInputs.length; i++) {
        const [branch] = await tx
          .insert(branches)
          .values({ ...input.branchInputs[i], organizationId: org.id, isDefault: i === 0 })
          .returning();
        branchIds.push(branch.id);
      }
      const defaultBranchId = branchIds[0];

      const [ownerUser] = await tx
        .insert(user)
        .values({ ...input.ownerUser, orgId: org.id })
        .returning();

      await tx.insert(branchMembers).values({
        orgId: org.id,
        branchId: defaultBranchId,
        userId: ownerUser.id,
        orgRole: input.ownerBranchMemberRoleAndActive.orgRole,
        isActive: input.ownerBranchMemberRoleAndActive.isActive,
      });

      for (const agent of input.agents) {
        const [agentUser] = await tx
          .insert(user)
          .values({ ...agent.user, orgId: org.id })
          .returning();
        const branchId = branchIds[agent.branchIndex ?? 0] ?? defaultBranchId;
        await tx.insert(branchMembers).values({
          orgId: org.id,
          branchId,
          userId: agentUser.id,
          orgRole: agent.branchMemberRoleAndActive.orgRole,
          isActive: agent.branchMemberRoleAndActive.isActive,
        });
      }

      return { orgId: org.id, ownerId: ownerUser.id, branchIds };
    });
  },
};
