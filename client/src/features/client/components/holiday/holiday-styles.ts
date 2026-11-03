// Shared class strings for the redesigned holiday detail page (cards, buttons).
// Tokens only: social-* / status-* / qp-* from index.css, no hex.

/** White rounded-[10px] card; padding drops to 16px on small phones. */
export const HOLIDAY_CARD = "rounded-2xl border border-social-border bg-card p-[22px] max-[620px]:p-4";

const BTN_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

/** Outline button (40px). */
export const HOLIDAY_BTN = `${BTN_BASE} border-social-border bg-card text-foreground hover:bg-muted`;
/** Primary orange action. */
export const HOLIDAY_BTN_PRIMARY = `${BTN_BASE} border-social-orange bg-social-orange text-slate-900 hover:bg-social-orange/90`;
/** Navy action (save forms). */
export const HOLIDAY_BTN_NAVY = `${BTN_BASE} border-social-navy-ink bg-social-navy-ink text-white hover:bg-social-navy-ink/90`;
/** Text-only blue button (Edit, Mark accepted, Supplier page). */
export const HOLIDAY_BTN_GHOST = `${BTN_BASE} min-h-8 border-transparent bg-transparent px-2.5 text-status-posted-fg hover:bg-status-posted-bg`;

const ICON_BASE =
  "grid size-10 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";
/** Round 40px outline icon button; aria-pressed turns it orange (pin). */
export const HOLIDAY_ICON_BTN = `${ICON_BASE} border border-social-border text-qp-muted hover:bg-muted hover:text-foreground aria-pressed:border-social-orange aria-pressed:bg-social-orange aria-pressed:text-slate-900`;
/** Round 40px filled blue icon button (rail "+"). */
export const HOLIDAY_ICON_BTN_BLUE = `${ICON_BASE} bg-primary text-primary-foreground hover:bg-primary/90`;

/** Form input (44px) used by the refs forms. */
export const HOLIDAY_INPUT =
  "h-11 w-full rounded-[10px] border border-social-border bg-card px-3.5 text-sm font-medium text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 aria-[invalid=true]:border-status-failed-fg aria-[invalid=true]:bg-status-failed-bg";
