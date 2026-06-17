import { useQueryClient } from "@tanstack/react-query";
import { quoteKeys } from "@/hooks/queries";
import { useUpdateQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Encapsulates the StatusPill change handler: opening the convert dialog on
 * "WON", patching the quote status on "LOST" or any other value, and
 * refreshing the cached detail. Returns the handler plus the underlying
 * mutation.
 */
export function useQuoteStatusUpdate(quoteId: string, onWon: () => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateQuoteMutation = useUpdateQuote();

  function onStatusChange(value: string) {
    if (value === "WON") {
      onWon();
      return;
    }

    if (value === "LOST") {
      updateQuoteMutation.mutate(
        { id: quoteId, data: { quote_status: "LOST" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
            toast({ title: "Quote marked as lost" });
          },
          onError: () => {
            toast({ title: "Failed to update status", variant: "destructive" });
          },
        },
      );
      return;
    }

    updateQuoteMutation.mutate(
      { id: quoteId, data: { quote_status: value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
          toast({ title: "Quote status updated" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        },
      },
    );
  }

  return { onStatusChange, updateQuoteMutation };
}
