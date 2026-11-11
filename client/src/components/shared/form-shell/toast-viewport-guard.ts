export const TOAST_VIEWPORT_ATTR = "data-toast-viewport";

/** True when the event target sits inside the toast viewport (rendered outside any dialog). */
export function isToastViewportTarget(target: EventTarget | null): boolean {
  const el = target as Element | null;
  return typeof el?.closest === "function" && el.closest(`[${TOAST_VIEWPORT_ATTR}]`) !== null;
}

/** Radix wraps the real DOM event in `detail.originalEvent`; fall back to the custom event's own target. */
export function isToastViewportInteraction(e: Event): boolean {
  const original = (e as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent;
  return isToastViewportTarget(original?.target ?? e.target);
}
