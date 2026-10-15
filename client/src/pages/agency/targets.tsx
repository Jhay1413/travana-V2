import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useBranches, useHomeworkerBranches } from "@/features/organization/api/use-branch-queries";
import AdminFinancialsTargets from "@/components/admin/admin-financials-targets";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { branchTypeOf, defaultTargetBranch, hasNoTargetBranches, hidesShopTargets } from "./utils/targets-helpers";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";

export default function AgencyTargetsPage() {
  const { can } = useRole();
  const { data: branches, isLoading } = useBranches();

  // Admin-only page, so the admin-only homeworker list is always allowed here.
  const { data: homeworkerBranches } = useHomeworkerBranches();
  const activeHomeworkers = useMemo(
    () => (homeworkerBranches ?? []).filter((b) => b.isActive),
    [homeworkerBranches],
  );

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive),
    [branches],
  );

  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (branchId) return;
    const preferred = defaultTargetBranch(activeBranches, activeHomeworkers);
    if (preferred) setBranchId(preferred);
  }, [activeBranches, activeHomeworkers, branchId]);

  const selectedType = branchTypeOf(branchId, activeBranches, activeHomeworkers);

  if (!can("admin", "team")) return <OwnerOnlyGate />;
  if (isLoading) return <PageLoading />;

  if (hasNoTargetBranches(activeBranches, activeHomeworkers)) {
    return (
      <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
        <div className="text-sm font-medium">No branches yet</div>
        <div className="mt-1 text-xs text-black/50 dark:text-white/50">
          Add a branch in Agency → Branches before setting targets.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <Building2 className="h-5 w-5 text-black/60 dark:text-white/60" />
        <div className="text-sm font-medium">Branch</div>
        <Select value={branchId ?? undefined} onValueChange={setBranchId}>
          <SelectTrigger className="h-9 w-[260px] rounded-xl" data-testid="select-targets-branch">
            <SelectValue placeholder="Select a branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Branches</SelectLabel>
              {activeBranches.map((b) => (
                <SelectItem key={b.id} value={b.id} data-testid={`option-targets-branch-${b.id}`}>
                  {b.name}
                  {b.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
            {activeHomeworkers.length > 0 && (
              <SelectGroup>
                <SelectLabel>Homeworkers</SelectLabel>
                {activeHomeworkers.map((b) => (
                  <SelectItem key={b.id} value={b.id} data-testid={`option-targets-homeworker-${b.id}`}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-black/50 dark:text-white/50">
          Targets below apply to the selected branch and its agents.
        </div>
      </div>

      {branchId && <AdminFinancialsTargets key={branchId} branchId={branchId} hideShopTarget={hidesShopTargets(selectedType)} />}
    </div>
  );
}
