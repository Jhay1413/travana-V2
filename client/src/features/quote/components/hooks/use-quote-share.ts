import { useState } from "react";
import axiosClient from "@/api/client/axios-client";
import { useToast } from "@/hooks/use-toast";

/**
 * Manages the Share Quote popup: visibility, share-token generation, and
 * copy-to-clipboard with a brief "Copied" indicator.
 */
export function useQuoteShare(quoteId: string) {
  const { toast } = useToast();
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  async function openShare() {
    setShowSharePopup(true);
    if (!shareToken) {
      setShareLoading(true);
      try {
        const res = await axiosClient.post(`/api/v2/quote-share/${quoteId}/generate-token`);
        setShareToken(res.data.token);
      } catch {
        toast({ title: "Failed to generate share link", variant: "destructive" });
      }
      setShareLoading(false);
    }
  }

  async function copyShareLink(opts?: { silent?: boolean }) {
    if (!shareToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/view-quote/${shareToken}`);
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
