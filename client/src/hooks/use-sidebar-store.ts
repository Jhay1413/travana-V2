import { useSyncExternalStore } from "react";

let mobileOpen = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

export function setSidebarMobileOpen(value: boolean) {
  if (mobileOpen === value) return;
  mobileOpen = value;
  emit();
}

export function toggleSidebarMobileOpen() {
  setSidebarMobileOpen(!mobileOpen);
}

export function useSidebarMobileOpen() {
  return useSyncExternalStore(
    subscribe,
    () => mobileOpen,
    () => false,
  );
}
