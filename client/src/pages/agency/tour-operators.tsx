import { useMemo, useState } from "react";
import { Pencil, Plane, Plus, Search, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useTourOperators } from "@/features/tour-operator/api/use-tour-operator-queries";
import {
  useCreateTourOperator,
  useDeleteTourOperator,
  useUpdateTourOperator,
} from "@/features/tour-operator/api/use-tour-operator-mutations";
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
import type { TourOperator } from "@/features/tour-operator/types";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";
import { StatCard } from "@/features/organization/components/agency/StatCard";
import { TourOperatorSheet, type TourOperatorFormState } from "@/features/organization/components/agency/TourOperatorSheet";

function formToPayload(form: TourOperatorFormState): {
  name: string | null;
  commission_percentage: string | null;
} {
  const name = form.name.trim();
  const pct = form.commissionPercentage.trim();
  return {
    name: name || null,
    commission_percentage: pct === "" ? null : Number(pct).toFixed(2),
  };
}

function formatCommission(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function commissionAccent(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "text-black/40 dark:text-white/40";
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return "text-black/40 dark:text-white/40";
  if (n >= 10) return "text-emerald-700 dark:text-emerald-300";
  if (n >= 5) return "text-amber-700 dark:text-amber-300";
  return "text-black/70 dark:text-white/70";
}

export default function AgencyTourOperatorsPage() {
  const { can } = useRole();
  const allowed = can("admin", "branding");

  const { data: operators, isLoading } = useTourOperators();
  const createOperator = useCreateTourOperator();
  const updateOperator = useUpdateTourOperator();
  const deleteOperator = useDeleteTourOperator();
  const { toast } = useToast();

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<TourOperator | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TourOperator | null>(null);

  const list = operators ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => (o.name ?? "").toLowerCase().includes(q));
  }, [list, filter]);

  const totalCount = list.length;
  const withCommission = list.filter(
    (o) => o.commission_percentage !== null && o.commission_percentage !== "",
  ).length;
  const avgCommission = useMemo(() => {
    const nums = list
      .map((o) => Number(o.commission_percentage ?? NaN))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }, [list]);

  const closeSheet = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSubmit = (form: TourOperatorFormState) => {
    const payload = formToPayload(form);
    if (editing) {
      updateOperator.mutate(
        { id: editing.id, data: payload as Partial<TourOperator> },
        {
          onSuccess: () => {
            toast({ title: "Tour operator updated", description: payload.name ?? undefined });
            closeSheet();
          },
          onError: (err: any) =>
            toast({
              title: "Couldn't save",
              description: err?.message,
              variant: "destructive",
            }),
        },
      );
    } else {
      createOperator.mutate(
        payload as Omit<TourOperator, "id" | "createdAt" | "updatedAt">,
        {
          onSuccess: () => {
            toast({ title: "Tour operator created", description: payload.name ?? undefined });
            closeSheet();
          },
          onError: (err: any) =>
            toast({
              title: "Couldn't create",
              description: err?.message,
              variant: "destructive",
            }),
        },
      );
    }
  };

  const handleDelete = (op: TourOperator) => {
    deleteOperator.mutate(op.id, {
      onSuccess: () => {
        toast({ title: "Tour operator deleted", description: op.name ?? undefined });
        setConfirmDelete(null);
      },
      onError: (err: any) =>
        toast({
          title: "Couldn't delete",
          description: err?.message,
          variant: "destructive",
        }),
    });
  };

  if (!allowed) return <OwnerOnlyGate />;
  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Plane className="h-3.5 w-3.5" />} label="Operators" value={String(totalCount)} />
        <StatCard
          icon={<Plane className="h-3.5 w-3.5" />}
          label="With commission set"
          value={`${withCommission} / ${totalCount}`}
        />
        <StatCard
          icon={<Plane className="h-3.5 w-3.5" />}
          label="Avg commission"
          value={avgCommission !== null ? `${avgCommission.toFixed(2)}%` : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40 dark:text-white/40" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search operators…"
            className="h-9 rounded-xl pl-8"
            data-testid="input-tour-operator-search"
          />
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          data-testid="button-add-tour-operator"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add tour operator
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <Plane className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">
            {list.length === 0 ? "No tour operators yet" : "No operators match your search"}
          </div>
          <div className="text-xs text-black/50 dark:text-white/50">
            {list.length === 0
              ? "Add your first operator to start tracking commissions."
              : "Try a different search term."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-[1fr_140px_88px] gap-3 border-b border-black/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-black/50 dark:border-white/10 dark:text-white/50">
            <div>Name</div>
            <div className="text-right">Commission</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {filtered.map((op) => (
              <div
                key={op.id}
                className="grid grid-cols-[1fr_140px_88px] items-center gap-3 px-4 py-3"
                data-testid={`row-tour-operator-${op.id}`}
              >
                <div className="min-w-0">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(op);
                    }}
                    className="truncate text-left text-sm font-medium hover:underline"
                    data-testid={`button-edit-tour-operator-${op.id}`}
                  >
                    {op.name || "Untitled operator"}
                  </button>
                </div>
                <div className={`text-right text-sm font-semibold tabular-nums ${commissionAccent(op.commission_percentage)}`}>
                  {formatCommission(op.commission_percentage)}
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(op);
                    }}
                    className="rounded-lg p-1.5 text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                    title="Edit"
                    data-testid={`button-icon-edit-tour-operator-${op.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(op)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-500/10"
                    title="Delete"
                    data-testid={`button-icon-delete-tour-operator-${op.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TourOperatorSheet
        open={creating || !!editing}
        operator={editing}
        onClose={closeSheet}
        onSubmit={handleSubmit}
        isSubmitting={createOperator.isPending || updateOperator.isPending}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tour operator?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name ?? "This operator"}" will be removed from your catalog. Quotes
              and bookings that referenced it will keep working but lose the link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tour-operator">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-tour-operator"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
