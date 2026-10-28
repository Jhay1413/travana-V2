/** Card surface, matching the tour operators and departures pages. */
export const CARD = "flex min-w-0 flex-col gap-4 rounded-2xl border border-social-border bg-card p-4 xl:p-[22px]";

/** Section heading that sits on the page background, above a card or grid. */
export const SECTION_TITLE = "text-[15px] font-semibold xl:text-base";
export const SECTION_SUB = "mt-0.5 text-[12px] text-social-muted xl:text-[13px]";

/** Compact variants of the shared orange / outlined actions, for use inside cards. */
export const CARD_PRIMARY = "h-9 px-3.5 text-[13px]";
export const CARD_OUTLINE = "h-9 px-3 text-[13px]";

/** Borderless icon button that gains a border on hover (row delete / disconnect). */
export const ICON_ACTION =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-social-muted transition hover:border-social-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

/** Text-only secondary action, navy like the breadcrumb links. */
export const TEXT_ACTION =
  "inline-flex items-center gap-1.5 text-[12px] font-semibold text-social-navy hover:underline focus-visible:outline-none focus-visible:underline disabled:pointer-events-none disabled:opacity-50 xl:text-[13px]";

/** Select trigger and input shaped like the rest of the redesigned forms. */
export const FIELD = "h-10 rounded-[10px] border-social-border bg-card text-[13px] font-medium shadow-none";
