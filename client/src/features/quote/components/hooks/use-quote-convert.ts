import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useConvertToBooking } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

export interface QuoteConvertOptions {
  /** Toast title on success: a fixed string, or a function of the HAYS ref that was just saved. Defaults to "Quote converted to booking". */
  successToast?: string | ((haysRef: string) => string);
}

/**
 * Owns the Convert-to-Booking dialog: open state, the two ref-number fields,
 * and the confirm action which fires the mutation, refreshes quotes, and
 * navigates to the new booking.
 */
export function useQuoteConvert(quoteId: string, clientId: string, options: QuoteConvertOptions = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertHaysRef, setConvertHaysRef] = useState("");
  const [convertTourRef, setConvertTourRef] = useState("");
  const convertToBookingMutation = useConvertToBooking();

  function confirmConvert() {
    convertToBookingMutation.mutate(
      { quoteId, haysRef: convertHaysRef, supplierRef: convertTourRef },
      {
        onSuccess: (booking: any) => {
          setShowConvertDialog(false);
          setConvertHaysRef("");
          setConvertTourRef("");
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
          const { successToast } = options;
          toast({
            title:
              typeof successToast === "function"
                ? successToast(convertHaysRef)
                : (successToast ?? "Quote converted to booking"),
          });
          const targetClientId = clientId || booking?.client_id;
          if (targetClientId) {
            setLocation(`/clients/${targetClientId}?holiday=booking:${booking.id}`);
          } else {
            setLocation(`/bookings/${booking.id}`);
          }
        },
        onError: () => {
          toast({ title: "Failed to convert", variant: "destructive" });
        },
      },
    );
  }

  return {
    showConvertDialog,
    setShowConvertDialog,
    convertHaysRef,
    setConvertHaysRef,
    convertTourRef,
    setConvertTourRef,
    convertToBookingMutation,
    confirmConvert,
  };
}
