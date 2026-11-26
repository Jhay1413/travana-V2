import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { heldFor, hold, toastForResult, useStaffSend, type Held, type SendChannel, type WhatsappFallback } from "@/features/customer-messaging";
import { useToast } from "@/hooks/use-toast";
import { portalPinApi } from "./portal-pin.api";

export const portalPinKeys = {
  detail: (clientId: string) => ["portal-pin", clientId] as const,
};

/**
 * Portal PIN state and actions for one client — whether a PIN exists, set /
 * change / remove it, and send the client a one-time sign-in link by WhatsApp or SMS. Shared by
 * the overview's Portal Access card and the PIN modal so both stay in step.
 */
export function usePortalPin(clientId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const staffSend = useStaffSend();
  // The wa.me hand-over when the link could not go through the agency's WhatsApp inbox (the text carries the one-time link).
  // Held with the client it was made for: it is never shown (or sent) while another client is on screen.
  const [heldFallback, setHeldFallback] = useState<Held<WhatsappFallback> | null>(null);
  const fallback = heldFor(heldFallback, clientId);

  const statusQuery = useQuery({
    queryKey: portalPinKeys.detail(clientId),
    queryFn: () => portalPinApi.get(clientId),
    enabled: !!clientId,
  });

  const setMutation = useMutation({
    mutationFn: (pin: string) => portalPinApi.set(clientId, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalPinKeys.detail(clientId) }),
  });

  const removeMutation = useMutation({
    mutationFn: () => portalPinApi.remove(clientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalPinKeys.detail(clientId) }),
  });

  /** Saves a 4-digit PIN; resolves true on success. */
  const setPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!/^\d{4}$/.test(pin)) return false;
      try {
        await setMutation.mutateAsync(pin);
        return true;
      } catch {
        toast({ title: "Failed to save PIN", variant: "destructive" });
        return false;
      }
    },
    [setMutation, toast],
  );

  const removePin = useCallback(async (): Promise<boolean> => {
    try {
      await removeMutation.mutateAsync();
      return true;
    } catch {
      toast({ title: "Failed to remove PIN", variant: "destructive" });
      return false;
    }
  }, [removeMutation, toast]);

  /** Sends a one-time sign-in link by the chosen channel (valid 48 hours, works once). Only that channel is used. */
  const sendLink = useCallback(
    (channel: SendChannel) => {
      setHeldFallback(null);
      staffSend.mutate(
        { clientId, purpose: "portal_sign_in", channel },
        {
          onSuccess: (data) => {
            if (data.status === "fallback") setHeldFallback(hold(clientId, data.fallback));
            const message = toastForResult(data, "sign-in link");
            if (message) toast(message);
          },
          onError: (e: unknown) => {
            const err = e as { response?: { data?: { message?: string } }; message?: string };
            toast({
              title: "Send failed",
              description: err?.response?.data?.message ?? err?.message,
              variant: "destructive",
            });
          },
          // The server may have flagged the customer as having to choose a PIN: show the real state.
          onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: portalPinKeys.detail(clientId) });
          },
        },
      );
    },
    [clientId, staffSend, toast, queryClient],
  );

  return {
    hasPin: statusQuery.data?.hasPin ?? false,
    mustChangePin: statusQuery.data?.mustChangePin ?? false,
    loading: statusQuery.isLoading,
    saving: setMutation.isPending || removeMutation.isPending,
    // A send for another client that is still in flight does not make this one look busy.
    sending: staffSend.isPending && staffSend.variables?.clientId === clientId,
    setPin,
    removePin,
    sendLink,
    fallback,
    clearFallback: () => setHeldFallback(null),
  };
}
