import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { shortId } from "../../lib/ticket-display";

/** The short ticket code with a copy button (copies the full id). */
export function TicketId({ id, className }: { id: string; className?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
        toast({ title: "Ticket number copied" });
      })
      .catch(() => toast({ title: "Couldn't copy", variant: "destructive" }));
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold text-social-muted", className)}>
      <span data-testid="ticket-short-id">#{shortId(id)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy ticket number"
        title="Copy ticket number"
        className="text-social-muted transition hover:text-foreground"
        data-testid="ticket-copy-id"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
