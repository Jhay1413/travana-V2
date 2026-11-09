import { useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { startPointerEventsWatchdog } from "@/components/shared/form-drawer";
import { FORM_OVERLAY_ATTR, findFormOpener, restoreFocusLater } from "./form-focus";

export type FormOverlayVariant = "enquiry" | "popup";

export interface FormOverlayProps {
  /** Accessible dialog name (also the hidden title). */
  label: string;
  /** Called on Escape, outside click or when the dialog asks to close. */
  onClose: () => void;
  /** Blocks Escape / outside-click closing (e.g. while saving). */
  preventClose?: boolean;
  /** Element id to focus on open; defaults to the first field. */
  initialFocusId?: string;
  /** "enquiry" = 1060px auto height; "popup" = 1200px, height min(1024px, 100vh - 48px). */
  variant?: FormOverlayVariant;
  "data-testid"?: string;
  children: ReactNode;
}

/**
 * Centred pop-up on Radix Dialog: Escape, focus trap/restore and scroll lock come from Radix.
 * z-index is 300/301, identical to the shadcn Dialog, so Radix Select (400), the inline
 * MultiSearchableSelect/DatePicker dropdowns (500/9999) and Add* modals stack above it.
 * Always mounted open: render it conditionally from the caller.
 */
export function FormOverlay({ label, onClose, preventClose, initialFocusId, variant = "enquiry", "data-testid": testId, children }: FormOverlayProps) {
  // Same stuck-body-pointer-events guard FormDrawer installs (docs/form-drawer-pointer-events-fix.md).
  useEffect(() => {
    startPointerEventsWatchdog();
  }, []);
  // Captured during the first render, before the dialog steals focus: the opener to refocus on close.
  const [opener] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : findFormOpener(document)));
  const contentRef = useRef<HTMLDivElement>(null);
  // Callers unmount this component instead of closing it, so Radix never restores focus itself.
  useEffect(() => () => restoreFocusLater(opener), [opener]);
  const block = (e: Event) => {
    if (preventClose) e.preventDefault();
  };
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !preventClose) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fm-scrim" />
        <DialogPrimitive.Content
          ref={contentRef}
          className="fm-dialog"
          {...{ [FORM_OVERLAY_ATTR]: "" }}
          data-testid={testId}
          aria-describedby={undefined}
          onEscapeKeyDown={block}
          onInteractOutside={block}
          onOpenAutoFocus={(e) => {
            // Opening from a Radix menu races the menu's own focus return: apply initial focus
            // on the next frame, then re-check once the menu has fully closed.
            e.preventDefault();
            const focusInitial = () => {
              const content = contentRef.current;
              if (!content) return;
              const target =
                (initialFocusId ? document.getElementById(initialFocusId) : null) ??
                content.querySelector<HTMLElement>("input:not([type=hidden]),select,textarea,button:not([disabled]),[tabindex]:not([tabindex='-1'])") ??
                content;
              target.focus();
            };
            requestAnimationFrame(() => {
              focusInitial();
              window.setTimeout(() => {
                const content = contentRef.current;
                if (content && !content.contains(document.activeElement)) focusInitial();
              }, 30);
            });
          }}
        >
          <DialogPrimitive.Title className="fm-sr-only">{label}</DialogPrimitive.Title>
          <div className={`fm ${variant === "popup" ? "fm-q fm-q--popup" : "fm-enq"}`}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
