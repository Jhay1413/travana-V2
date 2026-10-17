import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useDeleteQuote } from "@/hooks/mutations";
import { quoteKeys } from "@/features/quote/api/use-quote-queries";
import { useSetFeatured, useSetPortalVisibility } from "@/features/quote/api/use-quote-mutations";
import type { EnrichedQuote } from "@/features/quote/types";
import { errorMessage } from "../lib/error-message";
import { derivePostStatus } from "../lib/post-status";
import { useUnschedulePost } from "./use-social-post-mutations";

/** Card-level actions (portal, featured, move to drafts, delete) with their toasts. */
export function usePostActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setPortal = useSetPortalVisibility();
  const setFeatured = useSetFeatured();
  const unschedule = useUnschedulePost();
  const deleteQuote = useDeleteQuote();
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null);

  const togglePortal = useCallback(
    async (quoteId: string, showOnPortal: boolean): Promise<boolean> => {
      try {
        await setPortal.mutateAsync({ id: quoteId, showOnPortal });
        toast({ title: showOnPortal ? "Added to portal" : "Removed from portal" });
        return true;
      } catch {
        toast({ title: "Failed to update portal visibility", variant: "destructive" });
        return false;
      }
    },
    [setPortal, toast],
  );

  const toggleFeatured = useCallback(
    async (quoteId: string, isFeatured: boolean): Promise<boolean> => {
      try {
        await setFeatured.mutateAsync({ id: quoteId, isFeatured });
        toast({ title: isFeatured ? "Marked as featured deal" : "Removed from featured deals" });
        return true;
      } catch {
        toast({ title: "Failed to update featured status", variant: "destructive" });
        return false;
      }
    },
    [setFeatured, toast],
  );

  const moveToDrafts = useCallback(
    async (quote: EnrichedQuote): Promise<void> => {
      if (!quote.dealId) return;
      setBusyQuoteId(quote.id);
      try {
        await unschedule.mutateAsync(quote.dealId);
        toast({ title: "Moved back to drafts" });
      } catch (err) {
        toast({ title: "Could not move to drafts", description: errorMessage(err, "Try again."), variant: "destructive" });
      } finally {
        setBusyQuoteId(null);
      }
    },
    [unschedule, toast],
  );

  /** Deletes the quote; a scheduled post is pulled from OnlySocials first so it cannot still go out. */
  const deletePost = useCallback(
    async (quote: EnrichedQuote): Promise<void> => {
      setBusyQuoteId(quote.id);
      try {
        // Derived now, not at render time: a post whose time has passed is already live.
        if (derivePostStatus(quote) === "scheduled" && quote.dealId) await unschedule.mutateAsync(quote.dealId);
        await deleteQuote.mutateAsync(quote.id);
        await queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
        toast({ title: "Post deleted" });
      } catch (err) {
        toast({ title: "Could not delete post", description: errorMessage(err, "Try again."), variant: "destructive" });
      } finally {
        setBusyQuoteId(null);
      }
    },
    [unschedule, deleteQuote, queryClient, toast],
  );

  return { togglePortal, toggleFeatured, moveToDrafts, deletePost, busyQuoteId };
}
