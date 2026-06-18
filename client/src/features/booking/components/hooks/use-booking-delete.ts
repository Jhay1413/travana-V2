import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminDeleteBooking } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Owns the admin Delete Booking dialog: open state, reason text, and the
 * confirm action which fires the admin-delete mutation and navigates back.
 */
export function useBookingDelete(bookingId: string, clientId: string) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const adminDeleteBookingMutation = useAdminDeleteBooking();

  function openDeleteDialog() {
    setDeleteReason("");
    setShowDeleteDialog(true);
  }

  function confirmDelete() {
    adminDeleteBookingMutation.mutate(
      { id: bookingId, reason: deleteReason.trim() },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
          toast({ title: "Booking deleted successfully" });
          setLocation(clientId ? `/clients/${clientId}` : "/bookings");
        },
        onError: () => {
          toast({ title: "Failed to delete booking", variant: "destructive" });
        },
      },
    );
  }

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    deleteReason,
    setDeleteReason,
    adminDeleteBookingMutation,
    openDeleteDialog,
    confirmDelete,
  };
}
