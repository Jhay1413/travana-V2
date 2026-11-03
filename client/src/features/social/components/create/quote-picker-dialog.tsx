import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFreeQuotesInfinite } from "@/features/quote/api/use-quote-queries";
import type { EnrichedQuote } from "@/features/quote/types";
import { getSubtitle, pricePerPersonLabel } from "@/features/social/lib/quote-card-fields";
import { operatorInitials } from "./operator-initials";

interface QuotePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the picker closes; the caller starts the generate flow. */
  onPick: (quote: EnrichedQuote) => void;
}

/**
 * Lists free (social) quotes that have no post yet. Pipeline quotes are out of scope for this pass.
 */
export function QuotePickerDialog({ open, onOpenChange, onPick }: QuotePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useFreeQuotesInfinite(
    50, false, "none", debounced, "", "", false, false, "all", [], { enabled: open }, "not_generated",
  );
  const quotes = useMemo(() => data?.pages.flatMap((page) => page.quotes) ?? [], [data]);

  const pick = (quote: EnrichedQuote) => {
    onOpenChange(false);
    onPick(quote);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] gap-4" data-testid="dialog-quote-picker">
        <DialogHeader>
          <DialogTitle>Pick a quote</DialogTitle>
          <DialogDescription>Pick the quote this post is built from. Luna writes the first draft.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotes" className="pl-10" data-testid="input-quote-picker-search" />
        </div>

        <div role="listbox" aria-label="Quotes without a post" className="max-h-[360px] space-y-1.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
          ) : isError ? (
            <p className="py-10 text-center text-sm text-red-600">Failed to load quotes.</p>
          ) : quotes.length === 0 ? (
            <p className="py-10 text-center text-sm text-social-muted">No quotes without a post. Create a new social quote instead.</p>
          ) : (
            quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(quote)}
                className="flex w-full items-center gap-3 rounded-xl border border-social-border bg-white p-2.5 text-left hover:bg-social-page"
                data-testid={`option-quote-${quote.id}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-social-navy text-xs font-bold text-white">
                  {operatorInitials(quote.main_tour_operator_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{quote.title || "Untitled"}</span>
                  <span className="block truncate text-xs text-social-muted">{getSubtitle(quote)}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold">{pricePerPersonLabel(quote)}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-social-orange px-2.5 py-1 text-xs font-semibold text-slate-900">
                  <Sparkles className="h-3 w-3" />
                  Generate
                </span>
              </button>
            ))
          )}
          {hasNextPage && (
            <Button type="button" variant="ghost" className="w-full text-xs" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
        <p className="text-xs text-social-muted">Only social (free) quotes are listed. Pipeline quotes are not included yet.</p>
      </DialogContent>
    </Dialog>
  );
}
