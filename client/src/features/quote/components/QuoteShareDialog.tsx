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
import {
  useSendQuoteWhatsapp,
  type QuoteWhatsappFallbackReason,
} from "../api/use-quote-share-queries";
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
  onSent?: (via: "link" | "whatsapp") => void;
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
  const sendWhatsapp = useSendQuoteWhatsapp();
  const [whatsappFallback, setWhatsappFallback] = useState<WhatsappFallback | null>(null);
  // Don't carry a fallback (or a stale mutation state) into the next time the dialog opens.
  const resetWhatsapp = sendWhatsapp.reset;
  useEffect(() => {
    if (!open) {
      setWhatsappFallback(null);
      resetWhatsapp();
    }
  }, [open, resetWhatsapp]);
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

  const sendWhatsappMessage = () => {
    if (!clientId || !quoteId) return;
    setWhatsappFallback(null);
    sendWhatsapp.mutate(
      { quoteId, clientId },
      {
        onSuccess: (data) => {
          if (data.status === "sent") {
            toast({ title: data.viaTemplate ? "Sent to the client as a WhatsApp template message" : "Quote link sent via WhatsApp" });
            onSent?.("whatsapp");
          } else {
            setWhatsappFallback({ reason: data.reason, text: data.text, detail: data.detail });
          }
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
    if (plan === "whatsapp" && !sendWhatsapp.isPending) sendWhatsappMessage();
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
              ? "Send the link below to your customer on WhatsApp. It is also copied to your clipboard."
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
                  disabled={sendWhatsapp.isPending}
                >
                  {sendWhatsapp.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : shareCopied ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {sendWhatsapp.isPending ? "Sending…" : shareCopied ? "Sent" : "Send"}
                </Button>
              </div>
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
