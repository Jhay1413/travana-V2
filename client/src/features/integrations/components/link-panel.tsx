import { Copy, ExternalLink, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { channelLabel } from "../lib/channel-status";
import { CARD_OUTLINE, ICON_ACTION } from "./classes";

export interface ReadyLink {
  channelType: string;
  url: string;
  expiresAt: string;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The "Link ready" panel shown after a connect link is generated (it also opened in a new tab). */
export function LinkPanel({ link, onClose }: { link: ReadyLink; onClose: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    const ok = await copyText(link.url);
    toast(ok ? { title: "Link copied" } : { title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
  };
  const expires = new Date(link.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div
      className="flex min-w-0 items-start gap-3 rounded-2xl border border-status-posted-fg/20 bg-status-posted-bg/50 p-4"
      data-testid="integrations-link-panel"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-status-posted-fg" aria-hidden>
        <Link2 className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold xl:text-[14px]" role="status">
          {channelLabel(link.channelType)} connect link opened in a new tab
        </div>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">
          If the tab didn't open, copy the link below. It expires {expires}.
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[10px] border border-social-border bg-card px-3 py-2 text-[12px]" data-testid="integrations-link-url">
            {link.url}
          </code>
          <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, CARD_OUTLINE)} onClick={() => void copy()} data-testid="button-copy-link">
            <Copy className="h-4 w-4" aria-hidden /> Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(OUTLINE_ACTION, CARD_OUTLINE)}
            onClick={() => window.open(link.url, "_blank", "noopener")}
            data-testid="button-open-link"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Open
          </Button>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss link" className={cn(ICON_ACTION, "-mr-1 -mt-1 h-8 w-8")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
