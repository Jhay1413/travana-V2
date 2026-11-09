/** Marker attribute on the FormOverlay dialog content. */
export const FORM_OVERLAY_ATTR = "data-form-overlay";

/**
 * Pass as `onCloseAutoFocus` on a DropdownMenuContent whose items open a form pop-up.
 * When a form overlay is mounted, Radix must not hand focus back to the menu trigger
 * (that races the dialog's initial focus and swallows Escape). FormOverlay restores
 * focus to the trigger itself when it closes.
 */
export function skipFocusReturnWhenFormOpens(e: Event): void {
  if (document.querySelector(`[${FORM_OVERLAY_ATTR}]`)) e.preventDefault();
}

interface OpenerCandidate {
  tagName: string;
  isBody: boolean;
  insideMenu: boolean;
}

/** Pure rule: is the currently focused element a usable thing to restore to? */
export function isRestorableOpener(c: OpenerCandidate | null): boolean {
  return c !== null && !c.isBody && c.tagName !== "HTML" && !c.insideMenu;
}

/**
 * The element to refocus when a form closes: a Radix menu trigger that is still open
 * (the form was opened from that menu), else the focused element if it is a real opener.
 */
export function findFormOpener(doc: Document): HTMLElement | null {
  const trigger = doc.querySelector<HTMLElement>('[aria-haspopup="menu"][data-state="open"]');
  if (trigger) return trigger;
  const active = doc.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const ok = isRestorableOpener({
    tagName: active.tagName,
    isBody: active === doc.body,
    insideMenu: active.closest('[role="menu"],[role="dialog"]') !== null,
  });
  return ok ? active : null;
}

/** Refocus `opener` after Radix has finished its own focus handling, only if nothing real has focus. */
export function restoreFocusLater(opener: HTMLElement | null): void {
  if (!opener) return;
  window.setTimeout(() => {
    const active = document.activeElement;
    const lost = !active || active === document.body;
    if (lost && opener.isConnected) opener.focus();
  }, 50);
}
