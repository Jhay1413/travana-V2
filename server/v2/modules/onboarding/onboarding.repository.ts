import { db } from "../../config/database";
import { organization, branches, branchMembers, user, userProfiles, hrRecordsTable, userOrgRoles } from "@shared/schema";
import type { InsertOrganization, InsertBranch, InsertUser, InsertBranchMember } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface OnboardingAgentInput {
  userValues: InsertUser;
  branchMember: InsertBranchMember;
}

export interface AgentProfileInput {
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
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
    profile?: AgentProfileInput;
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

      // Seed the new org with copies of the global tour_operator catalog
      // (rows where org_id IS NULL). Each org maintains its own copies and
      // edits commissions independently. See migration 0013.
      await tx.execute(sql`
        INSERT INTO tour_operator_table (name, commission_percentage, org_id)
        SELECT name, commission_percentage, ${org.id}
        FROM tour_operator_table
        WHERE org_id IS NULL
      `);

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

      // Multi-role: seed the junction table with the owner's primary org role.
      // The junction is the source of truth going forward; user.orgRole stays
      // populated as a derived "primary" for back-compat.
      if (input.ownerUser.orgRole) {
        await tx
          .insert(userOrgRoles)
          .values({ userId: ownerUser.id, orgId: org.id, role: input.ownerUser.orgRole })
          .onConflictDoNothing({ target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role] });
      }

      await tx
        .insert(hrRecordsTable)
        .values({ orgId: org.id, userId: ownerUser.id })
        .onConflictDoNothing({ target: hrRecordsTable.userId });

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

        if (agent.user.orgRole) {
          await tx
            .insert(userOrgRoles)
            .values({ userId: agentUser.id, orgId: org.id, role: agent.user.orgRole })
            .onConflictDoNothing({ target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role] });
        }

        await tx
          .insert(hrRecordsTable)
          .values({ orgId: org.id, userId: agentUser.id })
          .onConflictDoNothing({ target: hrRecordsTable.userId });

        const profile = agent.profile;
        const hasProfile =
          profile &&
          (profile.address ||
            profile.emergencyContactName ||
            profile.emergencyContactRelationship ||
            profile.emergencyContactPhone);
        if (hasProfile) {
          await tx.insert(userProfiles).values({
            userId: agentUser.id,
            address: profile!.address ?? null,
            emergencyContactName: profile!.emergencyContactName ?? null,
            emergencyContactRelationship: profile!.emergencyContactRelationship ?? null,
            emergencyContactPhone: profile!.emergencyContactPhone ?? null,
          });
        }
      }

      return { orgId: org.id, ownerId: ownerUser.id, branchIds };
    });
  },
};
