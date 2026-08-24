import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White design card used across the agent dashboard. */
export function DashboardCard({
  className,
  children,
  testId,
}: {
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04] md:p-5",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Segmented pill tabs — light bordered container, active tab white with orange text. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  testIdPrefix,
  fullWidth = false,
  transparent = false,
  dense = false,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  testIdPrefix: string;
  /** Stretch the control across its container, splitting it into equal segments. */
  fullWidth?: boolean;
  /** No container fill — the surface behind shows through (active pill stays white). */
  transparent?: boolean;
  /** Smaller text and padding. */
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "items-center gap-1 rounded-md border border-black/10 p-1.5 dark:border-white/10",
        transparent ? "bg-transparent" : "bg-black/[0.03] dark:bg-white/[0.03]",
        fullWidth ? "flex w-full" : "inline-flex max-w-full overflow-x-auto",
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "rounded-sm font-semibold transition",
            dense ? "px-2 py-1 text-xs" : "px-3 py-1 text-sm",
            fullWidth ? "flex-1 text-center" : "shrink-0",
            value === t.value
              ? "bg-white text-[#fe9a00] shadow-sm dark:bg-white/15 dark:text-[#fe9a00]"
              : "text-[#7c98b0] hover:text-[#5f7d97] dark:text-white/55 dark:hover:text-white",
          )}
          data-testid={`${testIdPrefix}-${t.value}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const AVATAR_PALETTE = [
  "bg-red-100 text-red-500",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-amber-100 text-amber-600",
  "bg-purple-100 text-purple-600",
];

/** Small initials chip, colour derived from the name so it stays stable. */
export function InitialsAvatar({
  name,
  className,
  solid = false,
}: {
  name: string | null | undefined;
  className?: string;
  solid?: boolean;
}) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  const hash = [...(name || "?")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        solid ? "bg-[#2E3D50] text-white" : AVATAR_PALETTE[hash % AVATAR_PALETTE.length],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function timeAgo(date?: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
