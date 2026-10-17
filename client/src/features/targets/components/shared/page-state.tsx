import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { TARGETS_CARD } from "./targets-styles";

export function TargetsLoading() {
  return (
    <div className="grid place-items-center py-24 text-social-muted" role="status" aria-label="Loading targets" data-testid="targets-loading">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function TargetsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={cn(TARGETS_CARD, "p-10 text-center")} role="alert" data-testid="targets-error">
      <div className="text-[15px] font-semibold">We couldn&apos;t load the targets</div>
      <p className="mt-1 text-[13px] text-social-muted">Check your connection and try again.</p>
      <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "mt-4")} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function TargetsEmpty({ title, children }: { title: string; children?: string }) {
  return (
    <div className={cn(TARGETS_CARD, "p-10 text-center")} data-testid="targets-empty">
      <div className="text-[15px] font-semibold">{title}</div>
      {children && <p className="mt-1 text-[13px] text-social-muted">{children}</p>}
    </div>
  );
}
