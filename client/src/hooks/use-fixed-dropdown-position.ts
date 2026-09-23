import { useLayoutEffect, useState, type RefObject } from "react";

/** Computed placement for a dropdown rendered with `position: fixed`, in viewport coordinates. */
export interface FixedDropdownPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const VIEWPORT_PADDING = 8; // mirrors the old Popover's `collisionPadding={8}`
const TRIGGER_OFFSET = 4; // mirrors the old Popover's `sideOffset={4}`
const MIN_DROPDOWN_HEIGHT = 150; // below this much room, prefer flipping above the trigger

/**
 * Computes (and, while `open`, keeps recomputing) a dropdown's `position: fixed`
 * coordinates from `triggerRef`'s current bounding rect, flipping above the trigger
 * when there isn't enough room below.
 *
 * Shared by `SearchableSelect` and `MultiSearchableSelect` — see
 * `docs/form-drawer-pointer-events-fix.md` (section 6) for why these dropdowns are
 * rendered inline (not portaled) and therefore need `position: fixed` computed from the
 * trigger rect to escape ancestor `overflow` clipping (e.g. a drawer's scroll container).
 */
export function useFixedDropdownPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean
): FixedDropdownPosition | null {
  const [position, setPosition] = useState<FixedDropdownPosition | null>(null);

  // useLayoutEffect so the first paint after opening already has the right position —
  // no flash at (0, 0).
  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const placeAbove = spaceBelow < MIN_DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

      let left = rect.left;
      const width = rect.width;
      if (left + width > viewportWidth - VIEWPORT_PADDING) {
        left = viewportWidth - VIEWPORT_PADDING - width;
      }
      if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

      setPosition(
        placeAbove
          ? {
              left,
              width,
              bottom: viewportHeight - rect.top + TRIGGER_OFFSET,
              maxHeight: Math.max(100, spaceAbove),
            }
          : {
              left,
              width,
              top: rect.bottom + TRIGGER_OFFSET,
              maxHeight: Math.max(100, spaceBelow),
            }
      );
    };

    updatePosition();

    // The drawer's own container scrolls (not the window), and `position: fixed`
    // coordinates go stale as soon as that happens — `capture: true` catches scroll
    // events from any ancestor scroll container, not just `window`.
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, triggerRef]);

  return position;
}
