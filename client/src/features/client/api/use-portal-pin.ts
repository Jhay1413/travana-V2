import { useCallback, useEffect, useState } from "react";
import { useSendSms } from "@/features/sms/api/use-sms-mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Portal PIN state and actions for one client — whether a PIN exists, set /
 * change / remove it, and text the client their portal login link. Shared by
 * the overview's Portal Access card and the older PortalPinSection so both
 * stay in step.
 */
export function usePortalPin(clientId: string) {
  const { toast } = useToast();
  const sendSms = useSendSms();
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/portal/has-pin/${clientId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { hasPin?: boolean }) => {
        if (cancelled) return;
        setHasPin(!!d.hasPin);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  /** Saves a 4-digit PIN; resolves true on success. */
  const setPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!/^\d{4}$/.test(pin)) return false;
      setSaving(true);
      try {
        const res = await fetch("/api/portal/set-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ clientId, pin }),
        });
        if (res.ok) {
          setHasPin(true);
          return true;
        }
        toast({ title: "Failed to save PIN", variant: "destructive" });
        return false;
      } catch {
        toast({ title: "Failed to save PIN", variant: "destructive" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clientId, toast],
  );

  const removePin = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/remove-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        setHasPin(false);
        return true;
      }
      toast({ title: "Failed to remove PIN", variant: "destructive" });
      return false;
    } catch {
      toast({ title: "Failed to remove PIN", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [clientId, toast]);

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

  return { hasPin, loading, saving, sending: sendSms.isPending, setPin, removePin, sendLink };
}
