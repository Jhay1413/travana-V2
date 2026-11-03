/** Orange primary action, as on Social Posts and the Inbox. */
export const PRIMARY_ACTION =
  "h-10 gap-2 rounded-[10px] border border-social-orange bg-social-orange px-[18px] text-[14px] font-semibold text-[#1F2937] hover:bg-social-orange-text";

/** Neutral outlined action (secondary buttons, "Move to…"). */
export const OUTLINE_ACTION =
  "h-10 gap-2 rounded-[10px] border border-social-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted";

/** Red-outlined action ("Mark as lost"). */
export const DANGER_GHOST =
  "h-10 gap-2 rounded-[10px] border border-[#FCA5A5] bg-card px-4 text-[13px] font-semibold text-stage-lost-fg hover:bg-stage-lost-bg dark:border-stage-lost-fg/40";

/** Small amber text link ("+ Add quote", "Reopen"). */
export { AMBER_LINK } from "@/components/shared/link-styles";

/** 30px square icon button with a 4px radius and visible border (column collapse, drawer close). */
export const ICON_BUTTON =
  "inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[4px] border border-black/15 bg-card text-social-muted transition hover:bg-muted hover:text-foreground dark:border-white/15";
