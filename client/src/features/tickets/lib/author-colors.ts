// Deterministic per-author bubble colours for ticket threads — the current
// user always reads as sky (matching the Notes tab's "isMe" bubble), everyone
// else is assigned one of a small pastel palette keyed off their user id so
// the same author always lands on the same colour across renders/sessions.

const PALETTE = [
  { bubble: "bg-emerald-50 text-black/85 dark:bg-emerald-500/10 dark:text-white/90", name: "text-emerald-700 dark:text-emerald-400" },
  { bubble: "bg-amber-50 text-black/85 dark:bg-amber-500/10 dark:text-white/90", name: "text-amber-700 dark:text-amber-400" },
  { bubble: "bg-violet-50 text-black/85 dark:bg-violet-500/10 dark:text-white/90", name: "text-violet-700 dark:text-violet-400" },
  { bubble: "bg-rose-50 text-black/85 dark:bg-rose-500/10 dark:text-white/90", name: "text-rose-700 dark:text-rose-400" },
  { bubble: "bg-teal-50 text-black/85 dark:bg-teal-500/10 dark:text-white/90", name: "text-teal-700 dark:text-teal-400" },
  { bubble: "bg-orange-50 text-black/85 dark:bg-orange-500/10 dark:text-white/90", name: "text-orange-700 dark:text-orange-400" },
] as const;

const ME_CLASSES = {
  bubble: "bg-sky-100 text-black/85 dark:bg-sky-500/15 dark:text-white/90",
  name: "text-sky-700 dark:text-sky-400",
};

/** Simple, deterministic string hash — good enough to spread user ids across the palette. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function authorBubbleClasses(userId: string, isMe: boolean): { bubble: string; name: string } {
  if (isMe) return ME_CLASSES;
  return PALETTE[hashString(userId) % PALETTE.length];
}
