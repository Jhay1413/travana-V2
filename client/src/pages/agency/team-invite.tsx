import { useRole } from "@/hooks/use-role";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { TeamInvitePage } from "@/features/team";

/** /agency/team/invite: add several people at once, or upload a spreadsheet. */
export default function AgencyTeamInvitePage() {
  const { orgRole, can } = useRole();
  const allowed = can("admin", "team") || orgRole === "branch_manager";

  if (!allowed) {
    return <OwnerOnlyGate description="Only the Agency Owner can invite people." />;
  }
  return <TeamInvitePage />;
}
