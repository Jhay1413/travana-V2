import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/queries";
import { useClientSearch, type NeonClient } from "@/features/client";
import { EnquiryWizard, buildEnquiryTransaction } from "@/features/enquiry";
import { useCreateTransaction } from "@/features/transaction";
import { cn } from "@/lib/utils";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

type Step = "client" | "enquiry";

/** "New deal": pick a client, then fill in the existing enquiry wizard (in its
 *  drawer form). Saving creates the transaction exactly as the client page does. */
export function NewDealDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const createTransaction = useCreateTransaction();
  const [step, setStep] = useState<Step>("client");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [client, setClient] = useState<NeonClient | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (open) return;
    setStep("client");
    setQuery("");
    setClient(null);
  }, [open]);

  const { data, isFetching } = useClientSearch(debounced, 8);
  const results = data?.clients ?? [];

  return (
    <>
      <Dialog open={open && step === "client"} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl border-social-border bg-card sm:max-w-[480px]" data-testid="dialog-new-deal">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold">New deal</DialogTitle>
            <DialogDescription className="text-[13px] text-social-muted">Choose the client this enquiry is for.</DialogDescription>
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
                data-testid="input-new-deal-client-search"
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
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className={PRIMARY_ACTION} disabled={!client || !currentUser?.id} onClick={() => setStep("enquiry")} data-testid="button-new-deal-continue">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnquiryWizard
        presentation="drawer"
        open={open && step === "enquiry"}
        onOpenChange={(o) => {
          if (!o) onOpenChange(false);
        }}
        onSubmit={(formData) => {
          if (!client || !currentUser?.id) return;
          createTransaction.mutate(buildEnquiryTransaction({ ...formData }, { clientId: client.id, userId: currentUser.id }), {
            onSuccess: () => {
              toast({ title: "Deal created" });
              onOpenChange(false);
            },
            onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
          });
        }}
        isSaving={createTransaction.isPending}
      />
    </>
  );
}
