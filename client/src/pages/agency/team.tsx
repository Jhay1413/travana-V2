import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { TeamPage } from "@/features/team";

/** Teams & Roles: admins manage, branch managers view and invite agents to their own branch. */
export default function AgencyTeamPage() {
  const { orgRole, can } = useRole();
  const allowed = can("admin", "team") || orgRole === "branch_manager";

  if (!allowed) {
    return <OwnerOnlyGate description="Only the Agency Owner can manage the team." />;
  }
  return <TeamPage />;
}
