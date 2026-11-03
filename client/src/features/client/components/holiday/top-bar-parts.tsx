import type { ReactNode } from "react";
import { Pin } from "lucide-react";
import { HOLIDAY_ICON_BTN } from "@/features/client/components/holiday/holiday-styles";

/** Round 40px icon button used by the top bar (Preview, Share). */
export function TopBarIconButton({
  label,
  onClick,
  disabled,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button type="button" className={HOLIDAY_ICON_BTN} aria-label={label} title={label} onClick={onClick} disabled={disabled} data-testid={testId}>
      {children}
    </button>
  );
}

/** Pin toggle: aria-pressed turns it orange. Stays available to read-only roles. */
export function TopBarPinButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={HOLIDAY_ICON_BTN}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin" : "Pin"}
      title={pinned ? "Unpin" : "Pin"}
      onClick={onToggle}
      data-testid="holiday-top-pin"
    >
      <Pin className="size-[18px]" />
    </button>
  );
}

/** Green Booked or blue Enquiry status pill at the end of the action row. */
export function TopBarStatusPill({ tone, children }: { tone: "good" | "info"; children: ReactNode }) {
  const colours = tone === "good" ? "bg-status-scheduled-bg text-status-scheduled-fg" : "bg-status-posted-bg text-status-posted-fg";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${colours}`}>{children}</span>;
}
