/**
 * Tiny module-level store for "is the notifications panel currently open".
 *
 * The panel (rendered inside the app header) and the floating toast
 * (rendered at the layout root) both react to the same notifications query
 * but live in different subtrees with no shared parent state — this avoids
 * threading a context/provider through the app shell just for one boolean.
 *
 * The panel writes to this store whenever it opens/closes; the toast reads
 * it to decide whether showing a toast for a newly-arrived notification
 * would be redundant with the panel already surfacing it (see
 * notification-toast.tsx).
 */
let panelOpen = false;

export function setNotificationsPanelOpen(next: boolean): void {
  panelOpen = next;
}

export function isNotificationsPanelOpen(): boolean {
  return panelOpen;
}
