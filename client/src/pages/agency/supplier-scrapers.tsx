import { useState } from "react";
import { FileSearch, Pencil, Plus, ServerCog, Trash2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { PageLoading } from "@/features/organization/components/agency/PageLoading";
import {
  useSupplierScrapers,
  useDeleteSupplierScraper,
  SupplierScraperDialog,
  SupplierSpecReviewDialog,
  SupplierScraperPicksDialog,
  type SupplierScraper,
} from "@/features/supplier-scraper";

export default function AgencySupplierScrapersPage() {
  const { data, isLoading } = useSupplierScrapers();
  const deleteMutation = useDeleteSupplierScraper();
  const { toast } = useToast();

  const [editing, setEditing] = useState<SupplierScraper | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SupplierScraper | null>(null);
  const [reviewing, setReviewing] = useState<SupplierScraper | null>(null);
  const [applyingPicks, setApplyingPicks] = useState(false);

  const list = data ?? [];

  const handleDelete = (row: SupplierScraper) => {
    deleteMutation.mutate(row.id, {
      onSuccess: () => {
        toast({ title: "Scraper deleted", description: row.supplierName });
        setConfirmDelete(null);
      },
      onError: (err: unknown) =>
        toast({
          title: "Couldn't delete",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        }),
    });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Supplier scrapers</h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            Store each supplier's trade-portal login so pasting a deal link into a quote auto-fills it.
            Credentials are encrypted and never shown again.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setApplyingPicks(true)} data-testid="button-apply-field-picks">
            <Wand2 className="mr-1 h-3.5 w-3.5" /> Apply field picks
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            data-testid="button-add-supplier-scraper"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add supplier
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <ServerCog className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">No supplier scrapers yet</div>
          <div className="text-xs text-black/50 dark:text-white/50">
            Add a supplier and its trade-portal login to enable one-click deal imports.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-[1fr_120px_120px_130px_88px] gap-3 border-b border-black/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-black/50 dark:border-white/10 dark:text-white/50">
            <div>Supplier</div>
            <div>Credentials</div>
            <div>Status</div>
            <div>Spec</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {list.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_120px_120px_130px_88px] items-center gap-3 px-4 py-3"
                data-testid={`row-supplier-scraper-${row.id}`}
              >
                <div className="min-w-0">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(row);
                    }}
                    className="truncate text-left text-sm font-medium hover:underline"
                  >
                    {row.supplierName}
                  </button>
                  <div className="text-xs text-black/40 dark:text-white/40">{row.supplierKey}</div>
                </div>
                <div className="text-xs">
                  {row.credentials.hasUsername && row.credentials.hasPassword ? (
                    <span className="text-emerald-700 dark:text-emerald-300">Set</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">Incomplete</span>
                  )}
                </div>
                <div className="text-xs">
                  {row.isActive ? (
                    <span className="text-emerald-700 dark:text-emerald-300">Active</span>
                  ) : (
                    <span className="text-black/40 dark:text-white/40">Disabled</span>
                  )}
                </div>
                <div className="text-xs">
                  {(() => {
                    const cfg = row.config as { extraction?: unknown; specNeedsReview?: boolean };
                    if (!cfg?.extraction) return <span className="text-black/30 dark:text-white/30">None</span>;
                    return cfg.specNeedsReview ? (
                      <button
                        onClick={() => setReviewing(row)}
                        className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
                        title="AI-generated from one page — review and approve"
                      >
                        Needs review
                      </button>
                    ) : (
                      <button
                        onClick={() => setReviewing(row)}
                        className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                        title="View the approved extraction spec"
                      >
                        Approved
                      </button>
                    );
                  })()}
                </div>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => setReviewing(row)}
                    className="rounded-lg p-1.5 text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                    title="Review extraction spec"
                  >
                    <FileSearch className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(row);
                    }}
                    className="rounded-lg p-1.5 text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(row)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SupplierSpecReviewDialog scraper={reviewing} onOpenChange={(open) => !open && setReviewing(null)} />

      <SupplierScraperPicksDialog open={applyingPicks} onOpenChange={setApplyingPicks} />

      <SupplierScraperDialog
        open={creating || !!editing}
        editing={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this supplier scraper?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.supplierName}" and its stored credentials will be removed. Deal links
              for this supplier will stop importing until you add it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
