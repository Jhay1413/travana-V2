import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/features/organization/api/use-branch-queries";
import { useAssignMemberBranch, useUnassignMemberBranch } from "@/features/organization/api/use-organization-mutations";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { teamErrorMessage } from "../../lib/error-message";
import { BranchSelect } from "../shared/branch-select";
import { TEAM_LABEL } from "../shared/team-styles";

const SUSPENDED_HINT = "Reactivate before changing branches";

/** The member's branches, with assign and unassign for admins. Homeworkers keep their own branch. */
export function BranchMemberships({ member, canEdit, suspended }: { member: OrgMember; canEdit: boolean; suspended: boolean }) {
  const { toast } = useToast();
  const { data: branches = [] } = useBranches();
  const assign = useAssignMemberBranch();
  const unassign = useUnassignMemberBranch();
  const [pick, setPick] = useState("");

  const userId = member.user.id;
  const homeworker = member.user.orgRole === "homeworker";
  const memberOf = new Set(member.branches.map((b) => b.branchId));
  const options = branches
    .filter((b) => b.isActive && !memberOf.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, isDefault: b.isDefault }));

  const fail = (title: string) => (err: unknown) =>
    toast({ title, description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" });

  return (
    <div data-testid="branch-memberships">
      <div className={TEAM_LABEL}>Branches</div>
      {member.branches.length === 0 ? (
        <p className="text-[13px] text-social-muted">Not in any branch.</p>
      ) : (
        <ul className="divide-y divide-social-border rounded-xl border border-social-border">
          {member.branches.map((b) => (
            <li key={b.branchId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]" data-testid={`branch-${b.branchId}`}>
              <span className="min-w-0 truncate font-medium">
                {b.branchName}
                {!b.isActive && <span className="ml-2 text-[12px] font-normal text-social-muted">(inactive)</span>}
              </span>
              {canEdit && !homeworker && (
                <button
                  type="button"
                  onClick={() =>
                    unassign.mutate(
                      { userId, branchId: b.branchId },
                      { onSuccess: () => toast({ title: "Removed from branch", description: b.branchName }), onError: fail("Couldn't remove from branch") },
                    )
                  }
                  disabled={unassign.isPending || suspended}
                  title={suspended ? SUSPENDED_HINT : undefined}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-stage-lost-fg hover:underline disabled:opacity-50"
                  aria-label={`Remove from ${b.branchName}`}
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && suspended && !homeworker && (
        <p className="mt-2 text-[12px] text-social-muted">{SUSPENDED_HINT}.</p>
      )}
      {canEdit && !homeworker && !suspended && options.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <BranchSelect label="Add to a branch" value={pick} options={options} onChange={setPick} emptyLabel="Add to a branch" className="h-9" />
          </div>
          <Button
            type="button"
            variant="outline"
            className={OUTLINE_ACTION}
            disabled={!pick || assign.isPending}
            onClick={() =>
              assign.mutate(
                { userId, branchId: pick },
                {
                  onSuccess: () => {
                    toast({ title: "Added to branch" });
                    setPick("");
                  },
                  onError: fail("Couldn't add to branch"),
                },
              )
            }
            data-testid="button-assign-branch"
          >
            {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
