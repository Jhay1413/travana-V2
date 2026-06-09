import { useState } from "react";
import { Check, Copy, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSendSms } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

interface QuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  shareCopied: boolean;
  shareLoading: boolean;
  onCopy: (opts?: { silent?: boolean }) => void;
  clientId?: string;
}

export function QuoteShareDialog({
  open,
  onOpenChange,
  shareToken,
  shareCopied,
  shareLoading,
  onCopy,
  clientId,
}: QuoteShareDialogProps) {
  const { toast } = useToast();
  const sendSms = useSendSms();
  // Both buttons drive the same mutation, so track which one fired to show the
  // spinner only on the button the user actually pressed.
  const [sendingAction, setSendingAction] = useState<"public" | "sms" | null>(null);
  const canSend = !!clientId && !!shareToken && !sendSms.isPending;

  const smsResultToast = (data: { sent: number; skipped: number; results: any[] }, sentTitle: string) => {
    if (data.sent > 0) {
      toast({ title: sentTitle });
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
    onCopy({ silent: !!clientId });
    if (!clientId || sendSms.isPending) return;
    setSendingAction("public");
    sendSms.mutate(
      {
        // ASCII only - the SMS provider rejects non-GSM characters (e.g. em dash).
        bodyOverride:
          "Hi {{first_name}}, your quote is ready - tap to view it: {{quote_url}} - {{company_name}}",
        publicQuoteLink: true,
        recipients: { mode: "client", clientId },
        triggerSource: "manual.quote_share_public",
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
      },
      {
        onSuccess: (data) => smsResultToast(data, "Quote link sent via SMS"),
        onError: smsErrorToast,
        onSettled: () => setSendingAction(null),
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
                  value={`${window.location.origin}/view-quote/${shareToken}`}
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
            </>
          ) : (
            <p className="text-xs text-black/50">Failed to generate link. Please close and try again.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
