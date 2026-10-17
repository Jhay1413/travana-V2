import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Title row for the side cards and the dashboard card. */
export function CardHead({ title, icon: Icon, right, testId }: { title: string; icon?: LucideIcon; right?: ReactNode; testId?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-status-posted-bg text-status-posted-fg">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
        )}
        <h2 className="truncate text-base font-semibold" data-testid={testId}>
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

export const CARD_CLASS = "min-w-0 rounded-2xl border border-social-border bg-card p-5";
