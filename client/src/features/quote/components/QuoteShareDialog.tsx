import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageCircle, MessageSquare } from "lucide-react";
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
import { useSendSms } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import {
  useSendQuoteWhatsapp,
  type QuoteWhatsappFallbackReason,
} from "../api/use-quote-share-queries";

const WHATSAPP_FALLBACK_COPY: Record<QuoteWhatsappFallbackReason, string> = {
  not_allowed: "WhatsApp can't be sent from this app for your account, so send it from your phone instead.",
  not_configured: "WhatsApp isn't connected for your agency, so send it from your phone instead.",
  no_contact: "This client isn't linked to a WhatsApp contact yet, so send it from your phone instead.",
  no_channel: "No active WhatsApp number is connected for your agency, so send it from your phone instead.",
  window_closed: "The client hasn't messaged in the last 24 hours, so WhatsApp needs to be sent from your phone.",
};

interface WhatsappFallback {
  reason: QuoteWhatsappFallbackReason;
  text: string;
}

interface QuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  shareCopied: boolean;
  shareLoading: boolean;
  onCopy: (opts?: { silent?: boolean }) => void | Promise<void>;
  clientId?: string;
  /** The quote this dialog is sharing — threaded through to the SMS send so
   *  the server texts *this* quote's link rather than falling back to the
   *  client's most-recently-tokened quote (which may be a different one). */
  quoteId?: string;
  /** The client's phone number, used to open WhatsApp on the agent's own device
   *  when the quote can't be sent through the agency inbox. */
  clientPhone?: string | null;
  /** Called after the link was copied ("link"), an SMS went out ("sms"), or a
   *  WhatsApp was sent / opened ("whatsapp"), so the caller can record the quote as sent. */
  onSent?: (via: "link" | "sms" | "whatsapp") => void;
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
  const sendSms = useSendSms();
  const sendWhatsapp = useSendQuoteWhatsapp();
  const [whatsappFallback, setWhatsappFallback] = useState<WhatsappFallback | null>(null);
  // Both buttons drive the same mutation, so track which one fired to show the
  // spinner only on the button the user actually pressed.
  const [sendingAction, setSendingAction] = useState<"public" | "sms" | null>(null);
  // Don't carry a fallback (or a stale mutation state) into the next time the dialog opens.
  const resetWhatsapp = sendWhatsapp.reset;
  useEffect(() => {
    if (!open) {
      setWhatsappFallback(null);
      resetWhatsapp();
    }
  }, [open, resetWhatsapp]);
  const canSend = !!clientId && !!shareToken && !sendSms.isPending;
  const canSendWhatsapp = !!clientId && !!quoteId && !!shareToken && !sendWhatsapp.isPending;
  const fallbackHref = (() => {
    const base = whatsAppLink(clientPhone);
    return base && whatsappFallback ? `${base}?text=${encodeURIComponent(whatsappFallback.text)}` : null;
  })();

  const smsResultToast = (data: { sent: number; skipped: number; results: any[] }, sentTitle: string) => {
    if (data.sent > 0) {
      toast({ title: sentTitle });
      onSent?.("sms");
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
  };

  const smsErrorToast = (e: any) =>
    toast({
      title: "Send failed",
      description: e?.response?.data?.message ?? e.message,
      variant: "destructive",
    });

  // The primary "Send" button: copy the public link, and - when a client is
  // attached - also text them that PUBLIC /view-quote link (no login/PIN).
  // When an SMS is going out we copy silently so the only toast is the send
  // result; with no client attached it's a plain copy-to-clipboard.
  const handleSend = () => {
    // With a client attached, "sent" is recorded from the SMS result below; the
    // copy is only a convenience. Without one, a successful copy IS the share.
    // A failed clipboard write never marks the quote as shared.
    Promise.resolve(onCopy({ silent: !!clientId }))
      .then(() => {
        if (!clientId) onSent?.("link");
      })
      .catch(() => toast({ title: "Couldn't copy link", variant: "destructive" }));
    if (!clientId || sendSms.isPending) return;
    setSendingAction("public");
    sendSms.mutate(
      {
        // ASCII only - the SMS provider rejects non-GSM characters (e.g. em dash).
        // Keep in sync with PUBLIC_QUOTE_MESSAGE_BODY in server/v2/modules/sms/sms.service.ts (WhatsApp uses it).
        bodyOverride:
          "Hi {{first_name}}, your quote is ready - tap to view it: {{quote_url}} - {{company_name}}",
        publicQuoteLink: true,
        recipients: { mode: "client", clientId },
        triggerSource: "manual.quote_share_public",
        quoteId,
      },
      {
        onSuccess: (data) => smsResultToast(data, "Quote link sent via SMS"),
        onError: smsErrorToast,
        onSettled: () => setSendingAction(null),
      },
    );
  };

  const handleSendSms = () => {
    if (!clientId) return;
    setSendingAction("sms");
    sendSms.mutate(
      {
        // Server resolves the org's own "Quote Link" template if it has one,
        // otherwise falls back to the built-in default body.
        category: "quote_link",
        recipients: { mode: "client", clientId },
        triggerSource: "manual.quote_share",
        quoteId,
      },
      {
        onSuccess: (data) => smsResultToast(data, "Quote link sent via SMS"),
        onError: smsErrorToast,
        onSettled: () => setSendingAction(null),
      },
    );
  };

  const handleSendWhatsapp = () => {
    if (!clientId || !quoteId) return;
    setWhatsappFallback(null);
    sendWhatsapp.mutate(
      { quoteId, clientId },
      {
        onSuccess: (data) => {
          if (data.status === "sent") {
            toast({ title: "Quote link sent via WhatsApp" });
            onSent?.("whatsapp");
          } else {
            setWhatsappFallback({ reason: data.reason, text: data.text });
          }
        },
        onError: smsErrorToast,
      },
    );
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
            Copy the link below and send it to your customer.
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
                  disabled={sendingAction !== null}
                >
                  {sendingAction === "public" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : shareCopied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {sendingAction === "public" ? "Sending…" : shareCopied ? "Sent" : "Send"}
                </Button>
              </div>
              {clientId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                  <div className="min-w-0 text-xs text-black/65">
                    Text this link to the client using your Quote Link SMS template (or the default if you haven’t set one up).
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 rounded-xl px-3"
                    onClick={handleSendSms}
                    disabled={!canSend}
                    data-testid="button-send-quote-sms"
                  >
                    {sendingAction === "sms" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {sendingAction === "sms" ? "Sending…" : "Send via SMS"}
                  </Button>
                </div>
              )}
              {clientId && (
                <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-xs text-black/65">
                      Send this link to the client on WhatsApp from your agency inbox.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0 rounded-xl px-3"
                      onClick={handleSendWhatsapp}
                      disabled={!canSendWhatsapp}
                      data-testid="button-send-quote-whatsapp"
                    >
                      {sendWhatsapp.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {sendWhatsapp.isPending ? "Sending…" : "Send via WhatsApp"}
                    </Button>
                  </div>
                  {whatsappFallback && (
                    <div
                      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      data-testid="whatsapp-fallback"
                    >
                      <p>{WHATSAPP_FALLBACK_COPY[whatsappFallback.reason]}</p>
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
