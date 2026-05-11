import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminDeleteQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Owns the admin Delete Quote dialog: open state, reason text, and the
 * confirm action which fires the admin-delete mutation and navigates back.
 */
export function useQuoteDelete(quoteId: string, clientId: string, pageLabel = "Quote") {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const adminDeleteQuoteMutation = useAdminDeleteQuote();

  function openDeleteDialog() {
    setDeleteReason("");
    setShowDeleteDialog(true);
  }

  function confirmDelete() {
    adminDeleteQuoteMutation.mutate(
      { id: quoteId, reason: deleteReason.trim() },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
          toast({ title: `${pageLabel} deleted successfully` });
          setLocation(clientId ? `/clients/${clientId}` : "/quotes");
        },
        onError: () => {
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
  };
}
