import { useState } from "react";
import { useCreateEnquiry, useCreateTransaction, useDeleteEnquiry, useUpdateEnquiry } from "@/hooks/mutations";
import { enquiryApi } from "@/api";
import type { EnquiryTable } from "@/types/quote";
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
  const [showEnquiryWizard, setShowEnquiryWizard] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryTable | null>(null);

  const createEnquiryMutation = useCreateEnquiry();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createTransactionMutation = useCreateTransaction();

  function handleEnquirySubmit(data: Partial<EnquiryTable> & Record<string, unknown>) {
    if (editingEnquiry) {
      updateEnquiryMutation.mutate(
        { id: editingEnquiry.id, data: data as Parameters<typeof enquiryApi.update>[1] },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            setEditingEnquiry(null);
            toast({ title: "Enquiry updated successfully" });
          },
          onError: () => {
            toast({ title: "Failed to update enquiry", variant: "destructive" });
          },
        },
      );
    } else {
      createTransactionMutation.mutate(
        {
          client_id: clientId,
          user_id: currentUserId || "",
          lead_source: undefined,
          is_test: data.is_test === true,
          enquiry: {
            title:
              (typeof data.enquiryTitle === "string" ? data.enquiryTitle : undefined) ||
              (typeof data.title === "string" ? data.title : undefined) ||
              "",
            holiday_type_id:
              (typeof data.holidayType === "string" ? data.holidayType : undefined) ||
              (typeof data.holiday_type_id === "string" ? data.holiday_type_id : undefined) ||
              "",
            travel_date:
              (typeof data.travelDate === "string" ? data.travelDate : undefined) ||
              (typeof data.travel_date === "string" ? data.travel_date : undefined) ||
              undefined,
            adults:
              (typeof data.passengersAdults === "number" ? data.passengersAdults : undefined) ||
              (typeof data.adults === "number" ? data.adults : undefined) ||
              undefined,
            children:
              (typeof data.passengersChildren === "number" ? data.passengersChildren : undefined) ||
              (typeof data.children === "number" ? data.children : undefined) ||
              undefined,
            infants:
              (typeof data.passengersInfants === "number" ? data.passengersInfants : undefined) ||
              (typeof data.infants === "number" ? data.infants : undefined) ||
              undefined,
            no_of_nights:
              (typeof data.nights === "number" ? data.nights : undefined) ||
              (typeof data.no_of_nights === "number" ? data.no_of_nights : undefined) ||
              undefined,
            flexible_nights: Array.isArray(data.flexible_nights)
              ? (data.flexible_nights as number[])
              : undefined,
            budget: data.budget || undefined,
            max_budget: data.max_budget || undefined,
            budget_type:
              (typeof data.budgetType === "string" ? data.budgetType : undefined) ||
              (typeof data.budget_type === "string" ? data.budget_type : undefined) ||
              undefined,
            cabin_type:
              (typeof data.cabinType === "string" ? data.cabinType : undefined) ||
              (typeof data.cabin_type === "string" ? data.cabin_type : undefined) ||
              undefined,
            accom_min_star_rating: data.accom_min_star_rating || undefined,
            flexibility_date: data.flexibility_date || undefined,
            flexible_date: data.flexible_date || undefined,
            weekend_lodge: data.weekend_lodge || undefined,
            no_of_guests: data.no_of_guests || undefined,
            no_of_pets: data.no_of_pets || undefined,
            accomodation_type_id: data.accomodation_type_id || undefined,
            pre_cruise_stay: data.pre_cruise_stay || undefined,
            post_cruise_stay: data.post_cruise_stay || undefined,
            status: "ACTIVE",
            notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : undefined,
            destinations: Array.isArray(data.destinations) ? (data.destinations as any) : undefined,
            resorts: Array.isArray(data.resorts) ? (data.resorts as any) : undefined,
            boardBases: Array.isArray(data.boardBases) ? (data.boardBases as any) : undefined,
            departureAirports: Array.isArray(data.departureAirports) ? data.departureAirports : undefined,
          },
        },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            toast({ title: "Enquiry created successfully" });
          },
          onError: () => {
            toast({ title: "Failed to create enquiry", variant: "destructive" });
          },
        },
      );
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
    setShowEnquiryWizard(true);
  }

  function openWizardForNew() {
    setEditingEnquiry(null);
    setShowEnquiryWizard(true);
  }

  function onWizardOpenChange(open: boolean) {
    setShowEnquiryWizard(open);
    if (!open) {
      setEditingEnquiry(null);
      onWizardClosed();
    }
  }

  return {
    showEnquiryWizard,
    setShowEnquiryWizard,
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
