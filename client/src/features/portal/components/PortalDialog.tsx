import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { usePortalOverlayContainer } from "../theme/PortalThemeProvider";

/**
 * A centred pop-up that mounts inside the `.portal-theme` wrapper (not document.body), so it
 * picks up the portal's cream/navy tokens, square corners and fonts.
 */
export function PortalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}) {
  const container = usePortalOverlayContainer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgba(0,26,58,0.62)]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[61] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-background p-7 text-foreground focus:outline-none"
          data-testid={testId}
        >
          <DialogPrimitive.Title className="portal-serif text-4xl font-light leading-[1.05] text-primary">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          <div className="mt-6">{children}</div>
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center text-[11px] font-normal uppercase tracking-[0.28em] text-primary"
            aria-label="Close"
          >
            Close
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
