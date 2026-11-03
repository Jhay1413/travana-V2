import { db } from "../../config/database";
import { organization, branches, branchMembers, user, hrRecordsTable, userOrgRoles } from "@shared/schema";
import type { InsertOrganization, InsertBranch, InsertUser } from "@shared/schema";
import { organizationRepository } from "../organization/organization.repository";
import { orgTourOperatorRepository } from "../tour-operator/org-tour-operator.repository";
import { tourOperatorCommissionSeed } from "@shared/tour-operator-seed";

export interface OnboardingSignupInput {
  organization: InsertOrganization;
  /** The single placeholder branch created at signup; it becomes the default. */
  branchInput: Omit<InsertBranch, "organizationId">;
  ownerUser: InsertUser;
  ownerBranchMemberRoleAndActive: { orgRole: string; isActive: boolean };
}

export interface OnboardingSignupResult {
  orgId: string;
  ownerId: string;
  branchIds: string[];
}

export const onboardingRepository = {
  /**
   * Atomic agency signup: create the organisation, its default branch, and the
   * owner user + their branch_member row. Either the whole signup commits or
   * none of it does.
   *
   * Caller is responsible for hashing passwords and generating verification
   * tokens before calling.
   */
  async signupAgency(input: OnboardingSignupInput): Promise<OnboardingSignupResult> {
    return db.transaction(async (tx) => {
      const [org] = await tx.insert(organization).values(input.organization).returning();

      // Tour operators are a platform-wide catalogue: a new org is linked to the SEED
      // operators at their seed commission (missing catalogue rows are created).
      // No user exists yet, so created_by is null.
      await orgTourOperatorRepository.linkSeedOperators(org.id, tourOperatorCommissionSeed, null, tx);

      const [branch] = await tx
        .insert(branches)
        .values({ ...input.branchInput, organizationId: org.id, isDefault: true })
        .returning();

      // Only this branch may ever be claimed by the setup wizard.
      await organizationRepository.mergeSettingsSection(org.id, "onboarding", { placeholderBranchId: branch.id }, tx);

      const [ownerUser] = await tx
        .insert(user)
        .values({ ...input.ownerUser, orgId: org.id })
        .returning();

      await tx.insert(branchMembers).values({
        orgId: org.id,
        branchId: branch.id,
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

      return { orgId: org.id, ownerId: ownerUser.id, branchIds: [branch.id] };
    });
  },
};
