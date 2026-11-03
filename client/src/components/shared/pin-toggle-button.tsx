import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinToggleButtonProps {
  pinned: boolean;
  onToggle: () => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * Small pin toggle for dense, fully-clickable cards. Outline icon when not
 * pinned, filled amber when pinned. Click and keydown are both stopped from
 * bubbling so the card's own onClick / Enter+Space handler never also fires.
 */
export function PinToggleButton({ pinned, onToggle, className, "data-testid": testId }: PinToggleButtonProps) {
  return (
    <button
      type="button"
      aria-label={pinned ? "Unpin deal" : "Pin deal"}
      aria-pressed={pinned}
      title={pinned ? "Unpin deal" : "Pin deal"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // The card handles Enter/Space on keydown and preventDefaults it, which would
      // swallow this button's native click. Stop it here; the browser then still
      // synthesises the click for the button itself.
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-black/[0.06] dark:hover:bg-white/10",
        pinned
          ? "text-amber-500 dark:text-amber-400"
          : "text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60",
        className,
      )}
      data-testid={testId}
    >
      <Pin className={cn("h-3 w-3", pinned && "fill-current")} />
    </button>
  );
}
