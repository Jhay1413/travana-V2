import { useState } from "react";
import { useCreateEnquiry, useCreateTransaction, useDeleteEnquiry, useUpdateEnquiry } from "@/hooks/mutations";
import { enquiryApi } from "@/api";
import type { EnquiryTable } from "@/features/quote/types";
import { buildEnquiryTransaction, toSaveResult, type EnquirySaveResult, type EnquirySubmitData } from "@/features/enquiry";
import { useToast } from "@/hooks/use-toast";

/**
 * Owns the enquiry workflows on the client page: editing enquiry state,
 * the wizard open state, and create/update/delete actions. Returns the
 * mutations so the wizard can show a saving state.
 */
export function useClientEnquiryActions(
  clientId: string,
  currentUserId: string | undefined,
  onWizardClosed: () => void,
) {
  const { toast } = useToast();
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryTable | null>(null);

  const createEnquiryMutation = useCreateEnquiry();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createTransactionMutation = useCreateTransaction();

  /**
   * Saves from the enquiry form: an update when editing, otherwise a new deal. Resolves to the
   * saved ids (create only) so "Save & start quote" can open the quote form.
   */
  async function handleEnquirySubmit(data: EnquirySubmitData): Promise<EnquirySaveResult | void> {
    if (editingEnquiry) {
      try {
        await updateEnquiryMutation.mutateAsync({ id: editingEnquiry.id, data: data as unknown as Parameters<typeof enquiryApi.update>[1] });
        setShowEnquiryForm(false);
        setEditingEnquiry(null);
        toast({ title: "Enquiry updated successfully" });
      } catch {
        toast({ title: "Failed to update enquiry", variant: "destructive" });
      }
      return;
    }
    try {
      const txn = await createTransactionMutation.mutateAsync(
        buildEnquiryTransaction(data, { clientId, userId: currentUserId || "" }),
      );
      setShowEnquiryForm(false);
      toast({ title: "Enquiry created successfully" });
      return toSaveResult(txn.enquiry, clientId);
    } catch {
      toast({ title: "Failed to create enquiry", variant: "destructive" });
    }
  }

  function handleDeleteEnquiry(id: string) {
    deleteEnquiryMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Enquiry deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete enquiry", variant: "destructive" });
      },
    });
  }

  function openWizardForEdit(enquiry: EnquiryTable) {
    setEditingEnquiry(enquiry);
    setShowEnquiryForm(true);
  }

  function openWizardForNew() {
    setEditingEnquiry(null);
    setShowEnquiryForm(true);
  }

  function onWizardOpenChange(open: boolean) {
    setShowEnquiryForm(open);
    if (!open) {
      setEditingEnquiry(null);
      onWizardClosed();
    }
  }

  return {
    showEnquiryForm,
    setShowEnquiryForm,
    editingEnquiry,
    setEditingEnquiry,
    handleEnquirySubmit,
    handleDeleteEnquiry,
    openWizardForEdit,
    openWizardForNew,
    onWizardOpenChange,
    createEnquiryMutation,
    updateEnquiryMutation,
    createTransactionMutation,
  };
}
