import { lazy, Suspense, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCloseOnOutsideOrEscape } from "@/hooks/use-close-on-outside-or-escape";
import { cn } from "@/lib/utils";

const EmojiPickerPanel = lazy(() => import("./emoji-picker-panel"));

interface EmojiInsertButtonProps {
  onPick: (emoji: string) => void;
  /** Which side of the button the picker opens toward. */
  side?: "top" | "bottom";
  className?: string;
  "data-testid"?: string;
}

/**
 * Ghost smile button that opens a searchable emoji picker.
 *
 * The picker is rendered inline (absolute, next to the button) rather than in a
 * Radix `Popover` portal: portaled popovers fight a surrounding Dialog's
 * FocusScope/RemoveScroll and end up dead to clicks (see
 * docs/form-drawer-pointer-events-fix.md). Mouse-down on the button and the
 * picker is default-prevented so the caller's caret/selection isn't stolen.
 */
export function EmojiInsertButton({
  onPick,
  side = "bottom",
  className,
  "data-testid": testId,
}: EmojiInsertButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  useCloseOnOutsideOrEscape(open, () => setOpen(false), [wrapperRef]);

  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <span ref={wrapperRef} className={cn("relative inline-flex", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-md text-black/45 hover:text-black/80 dark:text-white/45 dark:hover:text-white/80"
        aria-label="Insert emoji"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        data-testid={testId}
      >
        <Smile className="h-4 w-4" />
      </Button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1",
          )}
          // Keep the editor's selection when interacting with non-input parts of the picker.
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
          data-testid="popover-emoji-picker"
        >
          <Suspense
            fallback={
              <div className="flex h-[360px] w-[320px] items-center justify-center">
                <Spinner className="h-5 w-5" />
              </div>
            }
          >
            <EmojiPickerPanel
              dark={dark}
              onPick={(emoji) => {
                onPick(emoji);
                setOpen(false);
              }}
            />
          </Suspense>
        </div>
      )}
    </span>
  );
}
