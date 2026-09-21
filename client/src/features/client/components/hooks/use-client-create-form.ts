import { useState } from "react";
import { useCreateNeonClient } from "@/features/client/api/use-neon-client-mutations";
import type { NeonClient } from "@/features/client/types/neon-client";

const EMPTY_FORM = {
  clientType: "New Client",
  title: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  houseNumber: "",
  street: "",
  city: "",
  country: "",
  postcode: "",
};

export type ClientCreateForm = typeof EMPTY_FORM;

/**
 * Owns the New Client drawer/dialog form: field state, the postcode lookup,
 * and the create action. Shared by every "Add Client" entry point (clients
 * list, global create menu) so they submit through the one mutation instead
 * of each keeping its own copy of this logic.
 */
export function useClientCreateForm(onCreated?: (client: NeonClient) => void) {
  const [showNewClient, setShowNewClient] = useState(false);
  const [form, setForm] = useState<ClientCreateForm>(EMPTY_FORM);
  const [showAddressSection, setShowAddressSection] = useState(false);
  const [postcodeSearch, setPostcodeSearch] = useState("");
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const createNeonClientMutation = useCreateNeonClient();

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setShowAddressSection(false);
    setPostcodeSearch("");
    setPostcodeError("");
    setShowNewClient(true);
  }

  async function lookupPostcode() {
    if (!postcodeSearch.trim()) return;
    setPostcodeLoading(true);
    setPostcodeError("");
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeSearch.trim())}`,
      );
      const data = await response.json();
      if (data.status === 200 && data.result) {
        const result = data.result;
        setForm((f) => ({
          ...f,
          city: result.admin_district || result.primary_care_trust || result.admin_county || "",
          country: result.country || "United Kingdom",
          postcode: result.postcode || postcodeSearch.trim(),
        }));
        setPostcodeError("Postcode found! Please enter house number and street manually.");
      } else {
        setPostcodeError("Postcode not found. Please enter address manually.");
      }
    } catch {
      setPostcodeError("Failed to lookup postcode. Please enter address manually.");
    } finally {
      setPostcodeLoading(false);
    }
  }

  function handleCreateClient() {
    if (!form.firstName || !form.lastName || !form.phone) return;
    createNeonClientMutation.mutate(
      {
        firstName: form.firstName,
        surename: form.lastName,
        phoneNumber: form.phone,
        title: form.title || undefined,
        email: form.email || undefined,
        badge: form.clientType || undefined,
        houseNumber: form.houseNumber || undefined,
        street: form.street || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        post_code: form.postcode || undefined,
      },
      {
        onSuccess: (newClient) => {
          setShowNewClient(false);
          setForm(EMPTY_FORM);
          setPostcodeSearch("");
          setShowAddressSection(false);
          setPostcodeError("");
          onCreated?.(newClient);
        },
      },
    );
  }

  return {
    showNewClient,
    setShowNewClient,
    openCreateDialog,
    form,
    setForm,
    showAddressSection,
    setShowAddressSection,
    postcodeSearch,
    setPostcodeSearch,
    postcodeLoading,
    postcodeError,
    lookupPostcode,
    handleCreateClient,
    isPending: createNeonClientMutation.isPending,
  };
}
