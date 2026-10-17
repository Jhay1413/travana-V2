import type { OrgMember } from "@/features/organization/api/organization.api";

/** Test helper: a valid active agent, with overrides. */
export function makeMember(over: Partial<OrgMember["user"]> & { branches?: OrgMember["branches"]; roles?: string[] } = {}): OrgMember {
  const { branches, roles, ...user } = over;
  return {
    user: {
      id: "u1",
      name: "Sam Rivers",
      email: "sam@example.com",
      firstName: "Sam",
      lastName: "Rivers",
      phoneNumber: null,
      image: null,
      emailVerified: true,
      banned: false,
      orgRole: "agent",
      ...user,
    },
    branches: branches ?? [{ branchId: "b1", branchName: "Main", orgRole: "agent", isActive: true }],
    roles,
  };
}
