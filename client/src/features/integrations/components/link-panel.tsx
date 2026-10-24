import { Copy, ExternalLink, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { useToast } from "@/hooks/use-toast";
import { channelLabel } from "../lib/channel-status";

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

/** The "Link ready" panel shown after a connect link is generated. */
export function LinkPanel({ link, onClose }: { link: ReadyLink; onClose: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    const ok = await copyText(link.url);
    toast(ok ? { title: "Link copied" } : { title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
  };
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-social-border bg-muted/40 p-3" data-testid="integrations-link-panel">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Link2 className="h-4 w-4 text-status-scheduled-fg" aria-hidden />
        <span className="min-w-0 flex-1">
          Link ready for {channelLabel(link.channelType)}
          <span className="ml-2 font-normal text-social-muted">expires {new Date(link.expiresAt).toLocaleString()}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Dismiss link" className="text-social-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="truncate rounded-lg border border-social-border bg-card px-2.5 py-2 font-mono text-[12px]" data-testid="integrations-link-url">
        {link.url}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => void copy()} data-testid="button-copy-link">
          <Copy className="h-4 w-4" aria-hidden /> Copy
        </Button>
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => window.open(link.url, "_blank", "noopener")} data-testid="button-open-link">
          <ExternalLink className="h-4 w-4" aria-hidden /> Open
        </Button>
      </div>
    </div>
  );
}
