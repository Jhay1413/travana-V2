import { format } from "date-fns";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The client's last message, quoted so the agent can check the fields against it. */
export function ChatQuote({ firstName, text, at }: { firstName: string; text: string; at: string }) {
  const when = new Date(at);
  return (
    <div className="mt-3 rounded-r-[10px] border-l-[3px] border-social-orange bg-[#FAFBFD] px-3.5 py-2.5 dark:bg-white/5">
      <div className="text-[12px] font-semibold text-social-muted">
        What {firstName} wrote{Number.isNaN(when.getTime()) ? "" : ` · ${format(when, "d MMM, HH:mm")}`}
      </div>
      <p className="mt-0.5 line-clamp-4 text-[13px]">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

/** Lists required details the client still has to supply, with a one-click question. */
export function StillNeeded({ firstName, missing, onAsk }: { firstName: string; missing: string[]; onAsk(): void }) {
  if (missing.length === 0) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-[#FEF3C7] px-3.5 py-2.5 text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Still needed</div>
        <div className="text-[12px]">{missing.join(", ")}</div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAsk}
        className="h-8 shrink-0 rounded-lg bg-white/70 text-[12px] hover:bg-white dark:bg-transparent dark:hover:bg-white/10"
        data-testid="button-ask-client"
      >
        Ask {firstName}
      </Button>
    </div>
  );
}
