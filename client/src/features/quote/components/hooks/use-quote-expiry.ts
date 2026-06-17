import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateQuote } from "@/hooks/mutations";
import { quoteKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";

/**
 * Owns the Update Expiry dialog: open state, the date input value, and the
 * confirm action which patches the quote and refreshes its detail query.
 */
export function useQuoteExpiry(quoteId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const updateQuoteExpiryMutation = useUpdateQuote();

  function openExpiryDialog(currentIso: string) {
    setExpiryDate(currentIso);
    setShowExpiryDialog(true);
  }

  function confirmExpiry() {
    updateQuoteExpiryMutation.mutate(
      { id: quoteId, data: { date_expiry: new Date(expiryDate).toISOString() } as any },
      {
        onSuccess: () => {
          setShowExpiryDialog(false);
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
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
