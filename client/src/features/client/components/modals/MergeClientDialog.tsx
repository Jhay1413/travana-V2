import { useEffect, useState } from "react";
import { AlertTriangle, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNeonClients } from "@/hooks/queries";
import { useMergeNeonClients } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

type TargetClient = { id: string; firstName: string; surename: string; phoneNumber?: string | null; email?: string | null };

/**
 * Resolve a duplicate: move ALL of the current (source) client's records to a
 * chosen surviving (target) client, then archive the source. Irreversible from
 * the UI, so it requires an explicit target selection + confirmation.
 */
export function MergeClientDialog({
  open,
  onOpenChange,
  sourceClientId,
  sourceClientName,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceClientId: string;
  sourceClientName: string;
  onMerged?: (survivingClientId: string) => void;
}) {
  const { toast } = useToast();
  const mergeMutation = useMergeNeonClients();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [target, setTarget] = useState<TargetClient | null>(null);

  // Reset internal state whenever the dialog is opened/closed.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setTarget(null);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useNeonClients({ search: debouncedSearch, limit: 8 });
  const results = (searchResults?.clients ?? []).filter((c) => c.id !== sourceClientId);

  function handleConfirm() {
    if (!target) return;
    mergeMutation.mutate(
      { sourceId: sourceClientId, targetId: target.id },
      {
        onSuccess: (survivor) => {
          onOpenChange(false);
          toast({ title: "Clients merged successfully" });
          onMerged?.(survivor?.id ?? target.id);
        },
        onError: (err: unknown) => {
          toast({
            title: "Failed to merge clients",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl" data-testid="dialog-merge-client">
        <DialogHeader>
          <DialogTitle>Merge duplicate client</DialogTitle>
          <DialogDescription>
            Move every deal, file, note, ticket and message from{" "}
            <span className="font-semibold text-black/80">{sourceClientName}</span> into the client you
            select below. <span className="font-semibold text-black/80">{sourceClientName}</span> will then
            be archived.
          </DialogDescription>
        </DialogHeader>

        {/* Target picker */}
        {target ? (
          <div className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
              <UserRound className="h-4 w-4 text-black/40" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-black/40">Keep & merge into</p>
              <p className="truncate text-sm font-semibold text-black/80">
                {target.firstName} {target.surename}
                {target.phoneNumber && <span className="ml-1.5 font-normal text-black/40">{target.phoneNumber}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black/40 transition hover:bg-red-500/10 hover:text-red-600"
              title="Choose a different client"
              data-testid="button-merge-clear-target"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-black/10">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-black/30" />
              <input
                autoFocus
                type="text"
                placeholder="Search the client to keep by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-black/80 placeholder:text-black/30 focus:outline-none"
                data-testid="input-merge-target-search"
              />
            </div>
            {results.length > 0 && (
              <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto border-t border-black/5">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-black/[0.03]"
                      onClick={() => setTarget(c as TargetClient)}
                      data-testid={`merge-target-option-${c.id}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                        <UserRound className="h-4 w-4 text-black/40" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-black/80">
                          {c.firstName} {c.surename}
                        </p>
                        <p className="truncate text-[11px] text-black/40">{c.phoneNumber}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {debouncedSearch && results.length === 0 && (
              <p className="border-t border-black/5 px-3 py-3 text-center text-xs text-black/30">No clients found</p>
            )}
            {!debouncedSearch && (
              <p className="border-t border-black/5 px-3 py-3 text-center text-xs text-black/30">Start typing to search</p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs">
            This reassigns all of the duplicate's records and cannot be undone from the app. The duplicate is
            archived (not deleted) for audit.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => onOpenChange(false)}
            data-testid="button-merge-cancel"
          >
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-700"
            onClick={handleConfirm}
            disabled={!target || mergeMutation.isPending}
            data-testid="button-merge-confirm"
          >
            {mergeMutation.isPending ? "Merging..." : "Merge clients"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
