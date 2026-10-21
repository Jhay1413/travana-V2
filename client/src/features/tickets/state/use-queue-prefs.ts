import { useCallback, useEffect, useState } from "react";
import { useRoles } from "@/hooks/use-role";
import { DEFAULT_PREFS, sanitizePrefs, type QueuePrefs } from "../lib/queue-prefs";

const STORAGE_KEY = "tickets.queue.v2";

// Roles that may switch the list scope to "all" (the server enforces it too).
const ADMIN_TICKET_ROLES = ["org_admin", "branch_manager", "platform_admin"] as const;

function read(): QueuePrefs {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw), true) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Queue view / scope / chip / sort / filters, kept for the browser session. */
export function useQueuePrefs() {
  const { hasAnyRole } = useRoles();
  const canViewAll = hasAnyRole([...ADMIN_TICKET_ROLES]);
  const [stored, setStored] = useState<QueuePrefs>(read);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage can be blocked; the prefs then just last for this page view.
    }
  }, [stored]);

  const patch = useCallback((next: Partial<QueuePrefs>) => setStored((prev) => ({ ...prev, ...next })), []);

  // "all" is admin-only; without an admin role it behaves as "mine" (the stored value is kept).
  const prefs: QueuePrefs = stored.scope === "all" && !canViewAll ? { ...stored, scope: "mine" } : stored;
  return { prefs, patch, canViewAll };
}
