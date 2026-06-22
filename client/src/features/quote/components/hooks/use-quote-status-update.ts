import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { quoteKeys, transactionKeys } from "@/hooks/queries";
import { useUpdateQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Encapsulates the StatusPill change handler: patching the quote status and
 * refreshing both the quote detail and pipeline caches on success.
 *
 * "Won" is no longer a status pill option — conversion is handled by the
 * dedicated "Convert to Booking" button. The `onWon` parameter has been
 * removed; callers that previously passed it should remove the argument.
 *
 * 409 handling: when marking a primary quote as "lost" while other active
 * quotes exist, the backend returns 409. The hook shows a specific toast
 * prompting the user to reassign the primary first.
 */
export function useQuoteStatusUpdate(quoteId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateQuoteMutation = useUpdateQuote();

  function invalidateCaches() {
    queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
    queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  }

  function onStatusChange(value: string) {
    if (value === "lost") {
      updateQuoteMutation.mutate(
        { id: quoteId, data: { quote_status: "lost" } },
        {
          onSuccess: () => {
            invalidateCaches();
            toast({ title: "Quote marked as lost" });
          },
          onError: (error) => {
            if (isAxiosError(error) && error.response?.status === 409) {
              toast({
                title: "Reassign the primary quote first",
                description:
                  "This is the primary quote and other active quotes exist. Choose a new primary, then mark this one lost.",
              });
            } else {
              toast({ title: "Failed to update status", variant: "destructive" });
            }
          },
        },
      );
      return;
    }

    updateQuoteMutation.mutate(
      { id: quoteId, data: { quote_status: value } },
      {
        onSuccess: () => {
          invalidateCaches();
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
