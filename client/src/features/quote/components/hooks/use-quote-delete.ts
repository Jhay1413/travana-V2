import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { isAxiosError } from "axios";
import { useAdminDeleteQuote } from "@/hooks/mutations";
import { useQuotes } from "@/features/quote/api/use-quote-queries";
import { useToast } from "@/hooks/use-toast";

export interface QuoteDeleteSibling {
  id: string;
  title: string | null;
  salesPrice: string | null;
  travelDate: string | null;
}

/**
 * Owns the admin Delete Quote dialog: open state, reason text, and the
 * confirm action which fires the admin-delete mutation and navigates back.
 *
 * When the quote being deleted is the transaction's primary quote AND the
 * transaction has other live (non-lost/archived) quotes, deleting it would
 * otherwise leave the transaction with no primary at all — the server rejects
 * that with a 400. In that case this hook fetches the live siblings (via the
 * same listQuotesByTransaction endpoint the pipeline board uses) so the
 * dialog can require the caller to pick one to promote before confirming.
 */
export function useQuoteDelete(
  quoteId: string,
  clientId: string,
  pageLabel = "Quote",
  options?: { transactionId?: string; isPrimary?: boolean },
) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [newPrimaryQuoteId, setNewPrimaryQuoteId] = useState("");
  const adminDeleteQuoteMutation = useAdminDeleteQuote();

  // Only fetch siblings while the dialog is open for a quote that is actually
  // primary — a copy being deleted never needs a promotion.
  const shouldFetchSiblings = !!options?.isPrimary && !!options?.transactionId && showDeleteDialog;
  const siblingsQuery = useQuotes(shouldFetchSiblings ? { transactionId: options!.transactionId } : undefined);

  const siblings = useMemo<QuoteDeleteSibling[]>(() => {
    if (!shouldFetchSiblings) return [];
    return (siblingsQuery.data ?? [])
      .filter((q) => q.id !== quoteId && q.quote_status !== "lost" && q.quote_status !== "archived")
      .map((q) => ({ id: q.id, title: q.title, salesPrice: q.sales_price, travelDate: q.travel_date }));
  }, [shouldFetchSiblings, siblingsQuery.data, quoteId]);

  const requiresNewPrimary = siblings.length > 0;

  function openDeleteDialog() {
    setDeleteReason("");
    setNewPrimaryQuoteId("");
    setShowDeleteDialog(true);
  }

  function confirmDelete() {
    if (requiresNewPrimary && !newPrimaryQuoteId) return;
    adminDeleteQuoteMutation.mutate(
      {
        id: quoteId,
        reason: deleteReason.trim(),
        newPrimaryQuoteId: requiresNewPrimary ? newPrimaryQuoteId : undefined,
      },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
          toast({ title: `${pageLabel} deleted successfully` });
          setLocation(clientId ? `/clients/${clientId}` : "/quotes");
        },
        onError: (err: unknown) => {
          if (isAxiosError(err) && err.response?.status === 400) {
            const message = (err.response?.data as { message?: string } | undefined)?.message;
            if (message === "NEW_PRIMARY_REQUIRED") {
              toast({
                title: "Pick a quote to promote",
                description: "This is the main quote — choose which copy should replace it before deleting.",
                variant: "destructive",
              });
              return;
            }
            if (message === "INVALID_NEW_PRIMARY") {
              toast({
                title: "Couldn't promote that quote",
                description: "That choice is no longer valid — refresh and try again.",
                variant: "destructive",
              });
              return;
            }
          }
          toast({ title: `Failed to delete ${pageLabel.toLowerCase()}`, variant: "destructive" });
        },
      },
    );
  }

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    deleteReason,
    setDeleteReason,
    adminDeleteQuoteMutation,
    openDeleteDialog,
    confirmDelete,
    siblings,
    requiresNewPrimary,
    newPrimaryQuoteId,
    setNewPrimaryQuoteId,
    siblingsLoading: shouldFetchSiblings && siblingsQuery.isLoading,
  };
}
