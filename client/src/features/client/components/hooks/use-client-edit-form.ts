import { useState } from "react";
import { useUpdateNeonClient } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

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

  function handleSaveClient() {
    const updates: Record<string, string | boolean | null> = {};
    if (editForm.title) updates.title = editForm.title;
    if (editForm.firstName) updates.firstName = editForm.firstName;
    if (editForm.surename) updates.surename = editForm.surename;
    updates.phoneNumber = editForm.phoneNumber;
    updates.email = editForm.email || null;
    updates.DOB = editForm.DOB || null;
    updates.houseNumber = editForm.houseNumber || null;
    updates.street = editForm.street || null;
    updates.city = editForm.city || null;
    updates.country = editForm.country || null;
    updates.post_code = editForm.post_code || null;
    updates.badge = editForm.badge || null;

    updateNeonClientMutation.mutate(
      { id: clientId, data: updates },
      {
        onSuccess: () => {
          setShowEditClient(false);
          toast({ title: "Client updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update client", variant: "destructive" });
        },
      },
    );
  }

  return {
    showEditClient,
    setShowEditClient,
    editForm,
    setEditForm,
    openEditDialog,
    handleSaveClient,
    isPending: updateNeonClientMutation.isPending,
    updateNeonClientMutation,
  };
}
