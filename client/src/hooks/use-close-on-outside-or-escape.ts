import { useEffect, type RefObject } from "react";

/**
 * Closes an open, non-portaled dropdown (see `useFixedDropdownPosition`) when the user
 * pointerdowns outside all of `containerRefs`, or presses Escape while it's open.
 *
 * Shared by `SearchableSelect` and `MultiSearchableSelect` — both dropdowns are rendered
 * as a plain sibling in the component's own DOM rather than portaled, so they need to
 * implement their own dismiss behavior instead of relying on Radix's `DismissableLayer`.
 *
 * - Pointerdown (not click) is used so the same pointerdown that *opens* the dropdown
 *   isn't immediately treated as an "outside" click — this listener is only attached once
 *   `open` is already true, i.e. after that pointerdown has already fired.
 * - `onClose` fires for both outside-pointerdown and Escape.
 * - `focusRefOnEscape`, if given, is focused after `onClose` fires from Escape
 *   specifically (not from an outside click) — mirrors returning focus to a trigger
 *   button after dismissing via keyboard.
 */
export function useCloseOnOutsideOrEscape(
  open: boolean,
  onClose: () => void,
  containerRefs: Array<RefObject<HTMLElement | null>>,
  focusRefOnEscape?: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRefs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    };

    // Escape closes only this dropdown. Radix dialogs/sheets (e.g. the quote drawer) listen
    // for Escape on the document in the capture phase, so a document listener here ran too
    // late and the same key press also closed the whole drawer, losing unsaved form work.
    // A window capture listener runs first and stops the event there.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
      focusRefOnEscape?.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirrors the original
    // effects this replaces: subscribe once per open/close cycle, not per render.
  }, [open]);
}
