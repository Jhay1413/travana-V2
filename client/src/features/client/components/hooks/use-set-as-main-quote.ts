import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { quoteKeys } from "@/hooks/queries";
import { useSetPrimaryQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * "Set as main quote" — same mutation, toasts and invalidation as the
 * standalone quote page (pages/quote/index.tsx handleSetAsMainQuote).
 */
export function useSetAsMainQuote(quoteId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useSetPrimaryQuote();

  function setAsMainQuote() {
    if (mutation.isPending) return;
    mutation.mutate(quoteId, {
      onSuccess: () => {
        toast({ title: "Set as main quote", description: "This quote is now the main quote." });
        queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      },
      onError: (err: unknown) => {
        const message = isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
        toast({
          title: "Couldn't set as main quote",
          description: message || "Please try again.",
          variant: "destructive",
        });
      },
    });
  }

  return { setAsMainQuote, isPending: mutation.isPending };
}
