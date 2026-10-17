import { useState } from "react";
import { Plus } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { Button } from "@/components/ui/button";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { HomeworkersList, InviteHomeworkerDialog } from "@/features/homeworkers";

export default function AgencyHomeworkersPage() {
  const { can } = useRole();
  const { data: org } = useCurrentOrganization();
  const [inviting, setInviting] = useState(false);

  if (!can("admin", "team")) return <OwnerOnlyGate />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold xl:text-xl">Homeworkers</h1>
          <p className="text-xs text-muted-foreground xl:text-sm">
            Each homeworker has their own branch and profit share.
          </p>
        </div>
        <Button onClick={() => setInviting(true)} style={{ background: org?.brandColor ?? undefined }} data-testid="button-invite-homeworker">
          <Plus className="mr-1 h-4 w-4" /> Invite homeworker
        </Button>
      </div>
      <HomeworkersList />
      <InviteHomeworkerDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
