import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent === "warn"
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate text-2xl font-semibold">{value}</div>
    </div>
  );
}
