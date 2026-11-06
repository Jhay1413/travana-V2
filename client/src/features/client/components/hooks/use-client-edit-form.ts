import { useState } from "react";
import { useUpdateNeonClient } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { getClientPhoneError, getRequestErrorMessage } from "@/features/client/lib/client-phone";
import { buildClientUpdates } from "@/features/client/lib/client-edit-updates";

const EMPTY_FORM = {
  title: "",
  firstName: "",
  surename: "",
  phoneNumber: "",
  email: "",
  DOB: "",
  houseNumber: "",
  street: "",
  city: "",
  country: "",
  post_code: "",
  badge: "",
};

export type ClientEditForm = typeof EMPTY_FORM;

interface ClientLike {
  title?: string | null;
  firstName?: string | null;
  surename?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  DOB?: string | null;
  houseNumber?: string | null;
  street?: string | null;
  city?: string | null;
  country?: string | null;
  post_code?: string | null;
  badge?: string | null;
}

/**
 * Owns the Edit Client dialog form: open state, the editForm fields, and
 * save action that patches the client record.
 */
export function useClientEditForm(clientId: string, clientData: ClientLike | null | undefined) {
  const { toast } = useToast();
  const [showEditClient, setShowEditClient] = useState(false);
  const [editForm, setEditForm] = useState<ClientEditForm>(EMPTY_FORM);
  const updateNeonClientMutation = useUpdateNeonClient();

  function openEditDialog() {
    if (!clientData) return;
    setEditForm({
      title: clientData.title || "",
      firstName: clientData.firstName || "",
      surename: clientData.surename || "",
      phoneNumber: clientData.phoneNumber || "",
      email: clientData.email || "",
      DOB: clientData.DOB || "",
      houseNumber: clientData.houseNumber || "",
      street: clientData.street || "",
      city: clientData.city || "",
      country: clientData.country || "",
      post_code: clientData.post_code || "",
      badge: clientData.badge || "",
    });
    setShowEditClient(true);
  }

  // Only a changed number is checked, so a stored legacy number never blocks other edits.
  const phoneError = getClientPhoneError(editForm.phoneNumber, clientData?.phoneNumber ?? "");

  function handleSaveClient() {
    if (phoneError) return;
    const updates = buildClientUpdates(editForm, clientData);

    updateNeonClientMutation.mutate(
      { id: clientId, data: updates },
      {
        onSuccess: () => {
          setShowEditClient(false);
          toast({ title: "Client updated successfully" });
        },
        onError: (error: unknown) => {
          toast({ title: "Failed to update client", description: getRequestErrorMessage(error, "Please try again."), variant: "destructive" });
        },
      },
    );
  }

  return {
    showEditClient,
    setShowEditClient,
    editForm,
    phoneError,
    setEditForm,
    openEditDialog,
    handleSaveClient,
    isPending: updateNeonClientMutation.isPending,
    updateNeonClientMutation,
  };
}
