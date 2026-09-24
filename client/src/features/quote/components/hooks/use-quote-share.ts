import { useEffect, useRef, useState } from "react";
import axiosClient from "@/api/client/axios-client";
import { env } from "@/config/env";
import { useToast } from "@/hooks/use-toast";

/**
 * Manages the Share Quote popup: visibility, share-token generation, and
 * copy-to-clipboard with a brief "Copied" indicator.
 *
 * `QuoteHeaderActions` is now `key`-ed by quote id (see
 * `holiday-header-actions.tsx`), so switching quotes there remounts this hook
 * fresh. The one caller that doesn't remount is `pages/quote/index.tsx`, which
 * drives this hook off a route param — navigating /quotes/A -> /quotes/B
 * changes `quoteId` without unmounting. So any cached token/popup state must
 * still be reset whenever `quoteId` changes, or a stale token (or a dialog
 * left open) from the previously viewed quote gets served for the new one.
 */
export function useQuoteShare(quoteId: string) {
  const { toast } = useToast();
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const currentQuoteIdRef = useRef(quoteId);

  useEffect(() => {
    currentQuoteIdRef.current = quoteId;
    // Close the dialog too: if it's still open for the quote we just switched
    // away from, the reset state below would otherwise render it as a
    // (fabricated) "Failed to generate link" error instead of just closing.
    setShowSharePopup(false);
    setShareToken(null);
    setShareCopied(false);
    // Covers the "switched quotes mid-flight" case from this side too — see
    // the `finally` in openShare for the other side of the same guard.
    setShareLoading(false);
  }, [quoteId]);

  async function openShare() {
    setShowSharePopup(true);
    if (shareToken) return;
    setShareLoading(true);
    const requestedQuoteId = quoteId;
    try {
      const res = await axiosClient.post<{ token: string }>(`/api/v2/quote-share/${quoteId}/generate-token`);
      // Ignore the response if the user switched to a different quote while
      // the request was in flight — don't let a late response for the old
      // quote overwrite the token now shown for the one currently being
      // viewed. Both the token-set and the error-toast are gated by the same
      // single check so there's no window between them for a stray `await`
      // to slip into.
      if (currentQuoteIdRef.current === requestedQuoteId) {
        setShareToken(res.data.token);
      }
    } catch {
      if (currentQuoteIdRef.current === requestedQuoteId) {
        toast({ title: "Failed to generate share link", variant: "destructive" });
      }
    } finally {
      // Always clear, regardless of which quote is now current — otherwise a
      // late-resolving request for an abandoned quote leaves the newly
      // viewed one stuck on a permanent spinner.
      setShareLoading(false);
    }
  }

  async function copyShareLink(opts?: { silent?: boolean }) {
    if (!shareToken) return;
    await navigator.clipboard.writeText(`${env.publicBaseUrl}/view-quote/${shareToken}`);
    setShareCopied(true);
    // Silent when the caller is also sending an SMS, so the only toast the user
    // sees is the send result rather than a confusing "copied to clipboard".
    if (!opts?.silent) toast({ title: "Link copied to clipboard!" });
    setTimeout(() => setShareCopied(false), 2000);
  }

  return {
    showSharePopup,
    setShowSharePopup,
    shareToken,
    shareCopied,
    shareLoading,
    openShare,
    copyShareLink,
  };
}
