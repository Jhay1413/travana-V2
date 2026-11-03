import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/queries";
import { useClientSearch, type NeonClient } from "@/features/client";
import { cn } from "@/lib/utils";

const OUTLINE_ACTION =
  "h-10 gap-2 rounded-[10px] border border-social-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted";
const PRIMARY_ACTION =
  "h-10 gap-2 rounded-[10px] border border-social-orange bg-social-orange px-[18px] text-[14px] font-semibold text-foreground hover:bg-social-orange-text";

interface ClientPickDialogProps {
  open: boolean;
  /** What the client is being chosen for, e.g. "quote". */
  noun: string;
  onCancel: () => void;
  onPick: (client: NeonClient) => void;
}

/** First step of the create flows that need a client: search, select, continue. */
export function ClientPickDialog({ open, noun, onCancel, onPick }: ClientPickDialogProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [client, setClient] = useState<NeonClient | null>(null);
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setClient(null);
  }, [open]);

  const { data, isFetching } = useClientSearch(debounced, 8);
  const results = data?.clients ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="z-[300] rounded-2xl border-social-border bg-card sm:max-w-[480px]" data-testid="dialog-create-pick-client">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Select client</DialogTitle>
          <DialogDescription className="text-[13px] text-social-muted">Choose the client this {noun} is for.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients by name or number"
              className="h-10 rounded-[10px] border-social-border pl-9 text-[13px]"
              autoFocus
              data-testid="input-create-client-search"
            />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-social-muted" />}
          </div>
          <div className="max-h-64 overflow-y-auto rounded-[10px] border border-social-border">
            {results.length > 0 ? (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClient(c)}
                  className={cn(
                    "w-full border-b border-social-border px-4 py-2.5 text-left last:border-b-0",
                    client?.id === c.id ? "bg-stage-inplay-bg" : "hover:bg-muted",
                  )}
                >
                  <div className="text-[13px] font-medium">{c.firstName} {c.surename}</div>
                  <div className="text-[12px] text-social-muted">{c.phoneNumber}</div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-[13px] text-social-muted">
                {debounced ? (isFetching ? "Searching…" : "No clients found") : "Start typing to search clients"}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" className={PRIMARY_ACTION} disabled={!client || !currentUser?.id} onClick={() => client && onPick(client)} data-testid="button-create-pick-continue">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
