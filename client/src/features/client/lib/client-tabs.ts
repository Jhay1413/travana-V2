export type ClientTabKey = "tasks" | "notes" | "chats" | "tickets" | "files" | "views" | "club-vip";

export const CLIENT_TABS: ReadonlyArray<{ value: ClientTabKey; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "notes", label: "Notes" },
  { value: "chats", label: "Chats" },
  { value: "tickets", label: "Tickets" },
  { value: "files", label: "Files" },
  { value: "views", label: "Views" },
  { value: "club-vip", label: "VIP" },
];

// Older links used ?tab=overview / ?tab=vip-club - keep them landing somewhere sensible.
const LEGACY_TAB_ALIASES: Record<string, ClientTabKey> = { overview: "tasks", "vip-club": "club-vip", vip: "club-vip" };

/** Tab named by the `?tab=` query string, defaulting to Tasks. */
export function resolveClientTab(search: string): ClientTabKey {
  const raw = new URLSearchParams(search).get("tab");
  if (!raw) return "tasks";
  if (CLIENT_TABS.some((t) => t.value === raw)) return raw as ClientTabKey;
  return LEGACY_TAB_ALIASES[raw] ?? "tasks";
}
