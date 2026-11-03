import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSendSms } from "@/features/sms/api/use-sms-mutations";
import { useToast } from "@/hooks/use-toast";
import { portalPinApi } from "./portal-pin.api";

export const portalPinKeys = {
  detail: (clientId: string) => ["portal-pin", clientId] as const,
};

/**
 * Portal PIN state and actions for one client — whether a PIN exists, set /
 * change / remove it, and text the client their portal login link. Shared by
 * the overview's Portal Access card and the PIN modal so both stay in step.
 */
export function usePortalPin(clientId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sendSms = useSendSms();

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

  const sendLink = useCallback(() => {
    sendSms.mutate(
      {
        // Server resolves the org's own "Portal Login" template if it has one,
        // otherwise falls back to the built-in default body.
        category: "portal_login",
        recipients: { mode: "client", clientId },
        triggerSource: "manual.portal_link",
      },
      {
        onSuccess: (data) => {
          if (data.sent > 0) {
            toast({ title: "Portal link sent via SMS" });
          } else if (data.skipped > 0) {
            const reason = data.results[0]?.status ?? "skipped";
            toast({
              title: "Not sent",
              description:
                reason === "skipped_optout"
                  ? "Client has opted out of SMS."
                  : reason === "skipped_no_phone"
                    ? "Client has no phone number on file."
                    : "Client skipped.",
              variant: "destructive",
            });
          } else {
            const err = data.results[0]?.error ?? "Send failed";
            toast({ title: "Send failed", description: err, variant: "destructive" });
          }
        },
        onError: (e: unknown) => {
          const err = e as { response?: { data?: { message?: string } }; message?: string };
          toast({
            title: "Send failed",
            description: err?.response?.data?.message ?? err?.message,
            variant: "destructive",
          });
        },
      },
    );
  }, [clientId, sendSms, toast]);

  return {
    hasPin: statusQuery.data?.hasPin ?? false,
    mustChangePin: statusQuery.data?.mustChangePin ?? false,
    loading: statusQuery.isLoading,
    saving: setMutation.isPending || removeMutation.isPending,
    sending: sendSms.isPending,
    setPin,
    removePin,
    sendLink,
  };
}
