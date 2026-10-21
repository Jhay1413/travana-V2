import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/queries";
import { useNeonClients } from "@/features/client/api/use-neon-client-queries";
import type { NeonClient } from "@/features/client/types/neon-client/neon-client.types";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import type { EnrichedQuote } from "@/features/quote/types";
import { buildCopyInitialValues } from "@/features/social/lib/quote-copy-values";

/**
 * Props:
 * - quote: the free social quote being copied.
 * - quoteImageUrls: its gallery, handed to the copy so the images come across.
 * - open / onOpenChange: the client picker (step 1); picking a client opens the create drawer (step 2).
 */
export interface SocialQuoteCopyFlowProps {
  quote: EnrichedQuote;
  quoteImageUrls: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Copy to client": search for a client, then create a client quote seeded from this one. */
export function SocialQuoteCopyFlow({ quote, quoteImageUrls, open, onOpenChange }: SocialQuoteCopyFlowProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NeonClient | null>(null);
  const { data: currentUser } = useCurrentUser();
  const { data: results, isLoading } = useNeonClients(open ? { search, limit: 10 } : undefined);
  const initialValues = useMemo(() => buildCopyInitialValues(quote), [quote]);
  const clients = results?.clients ?? [];

  function close() {
    onOpenChange(false);
    setSearch("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <DialogContent className="max-w-md rounded-2xl border-black/10 bg-white/95 p-6 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Copy to client</DialogTitle>
            <DialogDescription className="text-sm text-black/55">Search and select the client this quote will be copied to.</DialogDescription>
          </DialogHeader>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <Input
              autoFocus
              placeholder="Search by name or email…"
              className="h-9 rounded-[10px] border-black/10 bg-white/70 pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-black/10">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : clients.length === 0 ? (
              <p className="py-8 text-center text-sm text-black/40">{search ? "No clients found" : "Start typing to search"}</p>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition last:border-0 hover:bg-black/[0.03]"
                  onClick={() => {
                    setSelected(client);
                    close();
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-semibold text-black/60">
                    {client.firstName?.[0]}
                    {client.surename?.[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {client.firstName} {client.surename}
                    </div>
                    {client.email && <div className="truncate text-xs text-black/45">{client.email}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selected && (
        <QuoteCreateDialog
          presentation="drawer"
          open
          onOpenChange={(next) => {
            if (!next) setSelected(null);
          }}
          clientId={selected.id}
          userId={currentUser?.id || ""}
          markAsCopy={false}
          sourceQuoteId={quote.id}
          initialImages={quoteImageUrls}
          initialValues={initialValues}
        />
      )}
    </>
  );
}
