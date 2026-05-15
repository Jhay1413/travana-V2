import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useBranches } from "@/hooks/queries/use-branch-queries";
import { useCurrentOrganization } from "@/hooks/queries/use-organization-queries";
import { useUpdateBranch } from "@/hooks/mutations/use-branch-mutations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import BranchOverviewPage from "@/pages/branch-overview";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";
import { PageLoading } from "./components/PageLoading";
import { BranchSheet } from "./components/BranchSheet";
import { formToPayload } from "./utils/branch-helpers";

export default function AgencyBranchDetailPage() {
  const { can } = useRole();
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;

  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: org } = useCurrentOrganization();
  const updateBranch = useUpdateBranch();
  const { toast } = useToast();

  const branch = useMemo(
    () => (branches ?? []).find((b) => b.id === branchId) ?? null,
    [branches, branchId],
  );

  const [editing, setEditing] = useState(false);

  if (!can("admin", "branding")) return <OwnerOnlyGate />;
  if (branchesLoading) return <PageLoading />;

  if (!branch) {
    return (
      <div className="space-y-4">
        <Link
          href="/agency/branches"
          className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to branches
        </Link>
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">Branch not found</div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            It may have been deleted. Return to the branches list to pick another.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/agency/branches"
          className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          data-testid="link-back-to-branches"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to branches
        </Link>
        <Button
          variant="outline"
          onClick={() => setEditing(true)}
          data-testid="button-edit-branch"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit branch
        </Button>
      </div>

      <BranchOverviewPage key={branchId} branchId={branchId} />

      <BranchSheet
        open={editing}
        branch={branch}
        brandColor={org?.brandColor}
        onClose={() => setEditing(false)}
        onSubmit={(form) => {
          updateBranch.mutate(
            { id: branch.id, input: formToPayload(form) },
            {
              onSuccess: () => {
                toast({ title: "Branch updated", description: branch.name });
                setEditing(false);
              },
              onError: (err: any) =>
                toast({
                  title: "Couldn't update",
                  description: err?.message,
                  variant: "destructive",
                }),
            },
          );
        }}
        isSubmitting={updateBranch.isPending}
      />
    </div>
  );
}
