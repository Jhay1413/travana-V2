import { useLayoutEffect, useState, type RefObject } from "react";

/** Computed placement for a dropdown rendered with `position: fixed`, in the coordinate space `position: fixed` resolves against. */
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

/** Padding box (viewport coordinates) of an ancestor that acts as the containing block for `position: fixed`. */
interface ContainingBlockBox {
  left: number;
  top: number;
  height: number;
}

type StyleWithWebkitBackdrop = CSSStyleDeclaration & { webkitBackdropFilter?: string };

const isSet = (value: string | undefined): boolean => !!value && value !== "none";

/**
 * `position: fixed` is only viewport-relative when no ancestor establishes a containing
 * block for fixed descendants. `transform`, `perspective`, `filter`, `backdrop-filter`
 * (the app's `.glass` utility uses `backdrop-filter: blur(16px)`), `contain: paint/layout/...`
 * and a matching `will-change` all do — inside one, `left`/`top`/`bottom` resolve against
 * that ancestor's padding box, not the viewport, and the dropdown lands far from its trigger.
 * Returns that ancestor's padding box, or null when fixed really is viewport-relative.
 */
function findFixedContainingBlock(trigger: HTMLElement): ContainingBlockBox | null {
  let current: HTMLElement | null = trigger.parentElement;
  while (current && current !== document.body) {
    const el: HTMLElement = current;
    current = el.parentElement;
    const style = getComputedStyle(el) as StyleWithWebkitBackdrop;
    const establishes =
      isSet(style.transform) ||
      isSet(style.perspective) ||
      isSet(style.filter) ||
      isSet(style.backdropFilter) ||
      isSet(style.webkitBackdropFilter) ||
      /paint|layout|strict|content/.test(style.contain) ||
      /transform|perspective|filter/.test(style.willChange);
    if (!establishes) continue;

    // getBoundingClientRect() is the border box; the containing block is the padding box.
    const rect = el.getBoundingClientRect();
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    return {
      left: rect.left + borderLeft,
      top: rect.top + borderTop,
      height: rect.height - borderTop - borderBottom,
    };
  }
  return null;
}

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

      // Collision handling above is all in viewport space; only now translate into the
      // containing block's space (identity when there is no such ancestor).
      const cb = findFixedContainingBlock(trigger);
      const offsetLeft = cb?.left ?? 0;
      const offsetTop = cb?.top ?? 0;

      setPosition(
        placeAbove
          ? {
              left: left - offsetLeft,
              width,
              // `bottom` is measured up from the containing block's bottom edge, not the
              // viewport's. The panel's bottom edge is `rect.top - TRIGGER_OFFSET` in viewport space.
              bottom: cb
                ? cb.height - (rect.top - TRIGGER_OFFSET - offsetTop)
                : viewportHeight - rect.top + TRIGGER_OFFSET,
              maxHeight: Math.max(100, spaceAbove),
            }
          : {
              left: left - offsetLeft,
              width,
              top: rect.bottom + TRIGGER_OFFSET - offsetTop,
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
