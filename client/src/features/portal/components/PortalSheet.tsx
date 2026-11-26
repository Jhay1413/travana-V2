import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePortalOverlayContainer } from "../theme/PortalThemeProvider";

/**
 * A bottom sheet that mounts inside the `.portal-theme` wrapper (not document.body), so it wears the portal's
 * cream/navy tokens, square corners and fonts. As the design's sheets: navy 62% overlay, cream panel (12px 24px 32px),
 * a 40x3 handle, a header row (eyebrow and Close), the 36px serif heading, and the lxUp entrance. Focus is trapped
 * while it is open and Escape closes it.
 */
export function PortalSheet({
  open,
  onOpenChange,
  label,
  lead,
  italic,
  description,
  children,
  testId,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The small tracked label at the top ("Not interested"). */
  label: string;
  /** The serif heading: a first line and an italic second line. */
  lead: string;
  italic?: string;
  description?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Where focus goes when the sheet closes (default: back to what had it); call `preventDefault` to place it yourself. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const container = usePortalOverlayContainer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgba(0,26,58,0.62)]" />
        <DialogPrimitive.Content
          className="portal-sheet-in fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[94dvh] w-full max-w-xl overflow-y-auto bg-background px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-3 text-foreground focus:outline-none"
          data-testid={testId}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div aria-hidden className="mx-auto mb-3.5 h-[3px] w-10 bg-[#D9C7B1]" />
          <div className="flex items-center justify-between">
            <span className="portal-eyebrow">{label}</span>
            <DialogPrimitive.Close
              className="inline-flex min-h-11 items-center justify-center p-0 text-[11px] font-normal uppercase tracking-[0.28em] text-primary"
              data-testid="sheet-close"
            >
              Close
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="portal-serif mt-[18px] text-4xl font-light leading-[1.05] text-primary">
            {lead}
            {italic && (
              <>
                <br />
                <em className="italic">{italic}</em>
              </>
            )}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-2.5 text-sm leading-[1.65] text-muted-foreground">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{label}</DialogPrimitive.Description>
          )}
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
