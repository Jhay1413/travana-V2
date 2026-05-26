import { Check, Copy, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSmsTemplates } from "@/hooks/queries/use-sms-queries";
import { useSendSms } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

interface QuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  shareCopied: boolean;
  shareLoading: boolean;
  onCopy: () => void;
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
  const templatesQ = useSmsTemplates();
  const sendSms = useSendSms();
  const quoteLinkTemplate = (templatesQ.data ?? []).find(
    (t) => t.category === "quote_link" && t.active,
  );
  const canSend = !!clientId && !!shareToken && !!quoteLinkTemplate && !sendSms.isPending;

  const handleSendSms = () => {
    if (!clientId || !quoteLinkTemplate) return;
    sendSms.mutate(
      {
        templateId: quoteLinkTemplate.id,
        recipients: { mode: "client", clientId },
        triggerSource: "manual.quote_share",
      },
      {
        onSuccess: (data) => {
          if (data.sent > 0) {
            toast({ title: "Quote link sent via SMS" });
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
        onError: (e: any) =>
          toast({
            title: "Send failed",
            description: e?.response?.data?.message ?? e.message,
            variant: "destructive",
          }),
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
                  onClick={onCopy}
                >
                  {shareCopied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {shareCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              {clientId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                  <div className="min-w-0 text-xs text-black/65">
                    {quoteLinkTemplate
                      ? "Text this link to the client using the Quote Link SMS template."
                      : "Add an active “Quote Link” SMS template in SMS Center to enable texting."}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 rounded-xl px-3"
                    onClick={handleSendSms}
                    disabled={!canSend}
                    data-testid="button-send-quote-sms"
                  >
                    {sendSms.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {sendSms.isPending ? "Sending…" : "Send via SMS"}
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
