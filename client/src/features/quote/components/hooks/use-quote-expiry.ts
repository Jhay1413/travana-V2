import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateQuote } from "@/hooks/mutations";
import { quoteKeys, transactionKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { endOfDayIso, suggestNextExpiryDate, toDateInputValue } from "@/features/quote/lib/quote-expiry";

/**
 * Owns the Update Expiry dialog: open state, the date input value, and the
 * confirm action which patches the quote and refreshes its detail query.
 *
 * There's a single instance of this hook per quote-detail context (lifted to
 * the client page, see pages/client/index.tsx) so only one <QuoteExpiryDialog>
 * is ever mounted, even though both the hero card's "Extend expiry" banner
 * button and the header's "Update Expiry" menu item can open it.
 */
export function useQuoteExpiry(quoteId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const updateQuoteExpiryMutation = useUpdateQuote();

  // Suggests the current expiry when it's still valid, otherwise today + the
  // default extension — most useful for the common case of extending an
  // already-expired quote (see suggestNextExpiryDate). Takes the raw
  // date_expiry value (not a pre-formatted string) so every call site shares
  // the same yyyy-mm-dd conversion (toDateInputValue) instead of repeating it.
  function openExpiryDialog(dateExpiry: string | Date | null | undefined) {
    setExpiryDate(suggestNextExpiryDate(toDateInputValue(dateExpiry)));
    setShowExpiryDialog(true);
  }

  function confirmExpiry() {
    updateQuoteExpiryMutation.mutate(
      // End-of-LOCAL-day, not UTC midnight — date_expiry is a timestamptz
      // compared as a strict instant, so writing UTC midnight for "today"
      // would read as already-expired for most of the day in the UK (BST is
      // UTC+1). See endOfDayIso's doc comment.
      { id: quoteId, data: { date_expiry: endOfDayIso(expiryDate) } },
      {
        onSuccess: () => {
          setShowExpiryDialog(false);
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
          // Also refreshes pipeline columns and the agent dashboard's
          // "expiring quotes" widget — both are keyed under transactionKeys.all.
          queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          toast({ title: "Expiry date updated" });
        },
        onError: () => toast({ title: "Failed to update expiry", variant: "destructive" }),
      },
    );
  }

  return {
    showExpiryDialog,
    setShowExpiryDialog,
    expiryDate,
    setExpiryDate,
    updateQuoteExpiryMutation,
    openExpiryDialog,
    confirmExpiry,
  };
}
