// ─── Shared icon-button style ───────────────────────────────────────────────
// Squared, bordered buttons for the client page's header actions cluster
// (pin / link / share). The "···" trigger sits in the same row but is
// borderless per the design, so it gets its own class.

export const HEADER_ICON_BUTTON_CLASS =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border border-black/15 bg-white text-black/60 transition hover:bg-black/[0.03] hover:text-black dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white";

export const HEADER_ELLIPSIS_BUTTON_CLASS =
  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white";
