import { useMemo, useState } from "react";
import { Building2, Check, Plus, Search, Star } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useBranches } from "@/hooks/queries/use-branch-queries";
import { useCurrentOrganization } from "@/hooks/queries/use-organization-queries";
import { useCreateBranch, useUpdateBranch, useDeleteBranch } from "@/hooks/mutations/use-branch-mutations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";
import { PageLoading } from "./components/PageLoading";
import { StatCard } from "./components/StatCard";
import { BranchCard } from "./components/BranchCard";
import { BranchSheet } from "./components/BranchSheet";
import { formToPayload } from "./utils/branch-helpers";
import type { Branch } from "@/features/organization/api/branch.api";

export default function AgencyBranchesPage() {
  const { can } = useRole();
  const allowed = can("admin", "branding");
  const { data: org } = useCurrentOrganization();
  const { data: branches, isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();
  const { toast } = useToast();

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);

  const list = branches ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      (b.address ?? "").toLowerCase().includes(q) ||
      (b.email ?? "").toLowerCase().includes(q),
    );
  }, [list, filter]);

  const defaultBranch = list.find((b) => b.isDefault) ?? null;
  const activeCount = list.filter((b) => b.isActive).length;

  const closeSheet = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSetDefault = (b: Branch) => {
    if (b.isDefault) return;
    updateBranch.mutate(
      { id: b.id, input: { isDefault: true } },
      {
        onSuccess: () => toast({ title: "Default branch updated", description: b.name }),
        onError: (err: any) =>
          toast({ title: "Couldn't update", description: err?.message, variant: "destructive" }),
      },
    );
  };

  const handleToggleActive = (b: Branch) => {
    updateBranch.mutate(
      { id: b.id, input: { isActive: !b.isActive } },
      {
        onSuccess: () => toast({ title: b.isActive ? "Branch archived" : "Branch reactivated", description: b.name }),
        onError: (err: any) =>
          toast({ title: "Couldn't update", description: err?.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (b: Branch) => {
    deleteBranch.mutate(b.id, {
      onSuccess: () => {
        toast({ title: "Branch deleted", description: b.name });
        setConfirmDelete(null);
      },
      onError: (err: any) =>
        toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" }),
    });
  };

  if (!allowed) return <OwnerOnlyGate />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Branches" value={String(list.length)} />
        <StatCard icon={<Check className="h-4 w-4" />} label="Active" value={String(activeCount)} />
        <StatCard icon={<Star className="h-4 w-4" />} label="Default" value={defaultBranch?.name ?? "—"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search branches"
            className="pl-9"
            data-testid="input-branch-filter"
          />
        </div>
        <Button
          onClick={() => { setEditing(null); setCreating(true); }}
          style={{ background: org?.brandColor ?? undefined }}
          data-testid="button-new-branch"
        >
          <Plus className="mr-1 h-4 w-4" /> New branch
        </Button>
      </div>

      {isLoading ? (
        <PageLoading size="small" />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">No branches yet</div>
          <div className="text-xs text-black/50 dark:text-white/50">Add your first branch to get started.</div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              brandColor={org?.brandColor}
              onEdit={() => { setCreating(false); setEditing(b); }}
              onSetDefault={() => handleSetDefault(b)}
              onToggleActive={() => handleToggleActive(b)}
              onDelete={() => setConfirmDelete(b)}
            />
          ))}
        </div>
      )}

      <BranchSheet
        open={creating || !!editing}
        branch={editing}
        brandColor={org?.brandColor}
        onClose={closeSheet}
        onSubmit={(form) => {
          if (editing) {
            updateBranch.mutate(
              { id: editing.id, input: formToPayload(form) },
              {
                onSuccess: () => { toast({ title: "Branch updated", description: form.name }); closeSheet(); },
                onError: (err: any) =>
                  toast({ title: "Couldn't save", description: err?.message, variant: "destructive" }),
              },
            );
          } else {
            createBranch.mutate(formToPayload(form), {
              onSuccess: () => { toast({ title: "Branch created", description: form.name }); closeSheet(); },
              onError: (err: any) =>
                toast({ title: "Couldn't create", description: err?.message, variant: "destructive" }),
            });
          }
        }}
        isSubmitting={createBranch.isPending || updateBranch.isPending}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be removed. Members assigned only to this branch will lose access until reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-branch">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-branch"
            >
              Delete branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
