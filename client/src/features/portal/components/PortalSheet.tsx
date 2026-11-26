import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePortalOverlayContainer } from "../theme/PortalThemeProvider";

/**
 * A bottom sheet that mounts inside the `.portal-theme` wrapper (not document.body), so it wears the portal's
 * cream/navy tokens, square corners and fonts. Focus is trapped while it is open and Escape closes it.
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
}) {
  const container = usePortalOverlayContainer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[hsl(var(--portal-navy-deep)/0.7)]" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto border-t border-border bg-background px-7 pb-[max(28px,env(safe-area-inset-bottom))] pt-2 text-foreground shadow-xl focus:outline-none"
          data-testid={testId}
        >
          <div className="flex items-center justify-between">
            <span className="portal-eyebrow">{label}</span>
            <DialogPrimitive.Close
              className="-mr-3 inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-[11px] font-medium uppercase tracking-[0.2em] text-primary hover:text-[hsl(var(--portal-amber-ink))]"
              data-testid="sheet-close"
            >
              Close
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="portal-serif mt-2 text-[36px] font-light leading-[1.08] text-primary">
            {lead}
            {italic && (
              <>
                <br />
                <em className="italic">{italic}</em>
              </>
            )}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{label}</DialogPrimitive.Description>
          )}
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
