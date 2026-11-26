import { useEffect, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { env } from "@/config/env";
import { whatsAppLink } from "@/features/conversations";
import { useToast } from "@/hooks/use-toast";
import type { QuoteWhatsappFallbackReason } from "../api/use-quote-share-queries";
import { SendByChoice, effectiveChannel, canSendBy, heldFor, hold, toastForResult, useSendAvailability, useStaffSend, type Held, type SendChannel } from "@/features/customer-messaging";
import { planShareSend } from "../lib/quote-share-send";

const WHATSAPP_FALLBACK_COPY: Record<QuoteWhatsappFallbackReason, string> = {
  not_allowed: "WhatsApp can't be sent from this app for your account, so send it from your phone instead.",
  not_configured: "WhatsApp isn't connected for your agency, so send it from your phone instead.",
  no_contact: "This client isn't linked to a WhatsApp contact yet, so send it from your phone instead.",
  no_channel: "No active WhatsApp number is connected for your agency, so send it from your phone instead.",
  window_closed: "The client hasn't messaged in the last 24 hours, so WhatsApp needs to be sent from your phone.",
  template_failed: "The WhatsApp template couldn't be sent",
};

interface WhatsappFallback {
  reason: QuoteWhatsappFallbackReason;
  text: string;
  detail?: string;
}

interface SendError {
  message?: string;
  response?: { data?: { message?: string } };
}

interface QuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  shareCopied: boolean;
  shareLoading: boolean;
  onCopy: (opts?: { silent?: boolean }) => void | Promise<void>;
  clientId?: string;
  /** The quote this dialog is sharing — threaded through to the WhatsApp send so
   *  the server sends *this* quote's link. */
  quoteId?: string;
  /** The client's phone number, used to open WhatsApp on the agent's own device
   *  when the quote can't be sent through the agency inbox. */
  clientPhone?: string | null;
  /** Called after the link was copied ("link") or a WhatsApp was sent / opened
   *  ("whatsapp"), so the caller can record the quote as sent. */
  onSent?: (via: "link" | "whatsapp" | "sms") => void;
}

export function QuoteShareDialog({
  open,
  onOpenChange,
  shareToken,
  shareCopied,
  shareLoading,
  onCopy,
  clientId,
  quoteId,
  clientPhone,
  onSent,
}: QuoteShareDialogProps) {
  const { toast } = useToast();
  const sendQuote = useStaffSend();
  const planned = planShareSend({ clientId, quoteId });
  const availabilityQuery = useSendAvailability(clientId, "quote_link", open && planned === "whatsapp");
  // The pick and the hand-over belong to this client and quote: if either changes they are not carried over.
  const scopeKey = `${clientId ?? ""}:${quoteId ?? ""}`;
  const [pickedHeld, setPickedHeld] = useState<Held<SendChannel> | null>(null);
  const channel = effectiveChannel(heldFor(pickedHeld, scopeKey), availabilityQuery.data);
  const setPickedChannel = (c: SendChannel) => setPickedHeld(hold(scopeKey, c));
  const channelReady = canSendBy(channel, availabilityQuery.data);
  const [fallbackHeld, setFallbackHeld] = useState<Held<WhatsappFallback> | null>(null);
  const whatsappFallback = heldFor(fallbackHeld, scopeKey);
  const setWhatsappFallback = (value: WhatsappFallback | null) => setFallbackHeld(value ? hold(scopeKey, value) : null);
  // Don't carry a fallback, a channel pick or a stale mutation state into the next time the dialog opens.
  const resetSend = sendQuote.reset;
  useEffect(() => {
    if (!open) {
      setFallbackHeld(null);
      setPickedHeld(null);
      resetSend();
    }
  }, [open, resetSend]);
  const fallbackHref = (() => {
    const base = whatsAppLink(clientPhone);
    return base && whatsappFallback ? `${base}?text=${encodeURIComponent(whatsappFallback.text)}` : null;
  })();

  const sendErrorToast = (e: SendError) =>
    toast({
      title: "Send failed",
      description: e?.response?.data?.message ?? e?.message,
      variant: "destructive",
    });

  // Sends by the channel chosen above, and only that one: a channel that cannot deliver says why and nothing goes
  // out on the other (the staff member switches the choice themselves).
  const sendByChannel = () => {
    if (!clientId || !quoteId) return;
    setWhatsappFallback(null);
    sendQuote.mutate(
      { clientId, quoteId, purpose: "quote_link", channel },
      {
        onSuccess: (data) => {
          if (data.status === "fallback") {
            setWhatsappFallback({ reason: data.fallback.reason, text: data.fallback.text, detail: data.fallback.detail });
            return;
          }
          const message = toastForResult(data, "quote");
          if (message) toast(message);
          if (data.status === "sent") onSent?.(data.channel);
        },
        onError: sendErrorToast,
      },
    );
  };

  // The primary "Send" button: always copies the public link. With a client
  // attached it then sends that link on WhatsApp (copying silently so the only
  // toast is the send result); with no client it's a plain copy.
  const handleSend = () => {
    const plan = planShareSend({ clientId, quoteId });
    // For WhatsApp, "sent" is recorded from the send result; the copy is only a
    // convenience. Otherwise a successful copy IS the share. A failed clipboard
    // write never marks the quote as shared.
    Promise.resolve(onCopy({ silent: plan === "whatsapp" }))
      .then(() => {
        if (plan === "link") onSent?.("link");
      })
      .catch(() => toast({ title: "Couldn't copy link", variant: "destructive" }));
    if (plan === "whatsapp" && !sendQuote.isPending) sendByChannel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl"
        data-testid="dialog-share-quote"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Share Quote</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            {clientId
              ? "Send the link below to your customer by WhatsApp or SMS. It is also copied to your clipboard."
              : "Copy the link below and send it to your customer."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {shareLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-black/40" />
            </div>
          ) : shareToken ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${env.publicBaseUrl}/view-quote/${shareToken}`}
                  className="flex-1 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/70 outline-none"
                  data-testid="input-share-link"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  className="h-9 rounded-xl px-4"
                  data-testid="button-copy-share-link"
                  onClick={handleSend}
                  disabled={sendQuote.isPending || (planned === "whatsapp" && !channelReady)}
                >
                  {sendQuote.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : shareCopied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {sendQuote.isPending ? "Sending…" : shareCopied ? "Sent" : "Send"}
                </Button>
              </div>
              {planned === "whatsapp" && (
                <SendByChoice
                  availability={availabilityQuery.data}
                  loading={availabilityQuery.isLoading}
                  value={channel}
                  onChange={setPickedChannel}
                  disabled={sendQuote.isPending}
                />
              )}
              {planned === "whatsapp" && availabilityQuery.isError && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert" data-testid="send-by-error">
                  Couldn't check which channels can be used.
                  <button type="button" className="font-semibold underline" onClick={() => void availabilityQuery.refetch()} data-testid="button-send-by-retry">
                    Try again
                  </button>
                </p>
              )}
              {planned === "whatsapp" && !channelReady && !sendQuote.isPending && (
                // Send is off (still checking, the check failed, or neither channel can be used): copying the link always works.
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl px-3" onClick={() => void onCopy()} data-testid="button-copy-link-only">
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy link
                </Button>
              )}
              {clientId && whatsappFallback && (
                <div
                  className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  data-testid="whatsapp-fallback"
                >
                  {whatsappFallback.reason === "template_failed" ? (
                    <p>
                      {WHATSAPP_FALLBACK_COPY.template_failed}
                      {whatsappFallback.detail && (
                        <>
                          <br />
                          {whatsappFallback.detail}
                        </>
                      )}
                      <br />
                      You can still send it from your phone.
                    </p>
                  ) : (
                    <p>{WHATSAPP_FALLBACK_COPY[whatsappFallback.reason]}</p>
                  )}
                  {fallbackHref ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl px-3"
                      data-testid="link-open-in-whatsapp"
                    >
                      <a
                        href={fallbackHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onSent?.("whatsapp")}
                        onAuxClick={() => onSent?.("whatsapp")}
                      >
                        Open in WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <p className="text-amber-800/80" data-testid="text-whatsapp-no-phone">
                      This client has no valid phone number on file, so WhatsApp can't be opened.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-black/50">Failed to generate link. Please close and try again.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
