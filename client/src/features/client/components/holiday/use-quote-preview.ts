import { env } from "@/config/env";
import { useGenerateQuoteToken } from "@/features/quote/api/use-quote-share-queries";
import { useToast } from "@/hooks/use-toast";

/**
 * Preview as the customer sees it: opens /view-quote/{token} in a new tab.
 * The blank tab is opened synchronously inside the click (so popup blockers allow it),
 * then pointed at the public page once the token is known (existing, or generated).
 */
export function useQuotePreview(quoteId: string | null | undefined, knownToken: string | null | undefined) {
  const generateToken = useGenerateQuoteToken();
  const { toast } = useToast();

  async function openPreview() {
    if (!quoteId) return;
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const token = knownToken || (await generateToken.mutateAsync(quoteId));
      const url = `${env.publicBaseUrl}/view-quote/${token}?preview=1`;
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch {
      tab?.close();
      toast({ title: "Could not open the preview", variant: "destructive" });
    }
  }

  return { openPreview, isPending: generateToken.isPending };
}
