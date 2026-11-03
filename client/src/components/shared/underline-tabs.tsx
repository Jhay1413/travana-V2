import { cn } from "@/lib/utils";

/** Underline tab strip: selected tab is orange with a 2px underline, 1px rule under the whole row. */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  testIdPrefix,
  className,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  testIdPrefix: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("mb-1 flex flex-wrap [&+[role=link]]:border-t-0 gap-x-5 gap-y-1.5 border-b border-social-border xl:gap-x-[22px]", className)}
    >
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[12px] font-semibold transition-colors xl:text-[13px]",
              selected
                ? "border-social-orange text-social-orange-text"
                : "border-transparent text-social-muted hover:text-foreground",
            )}
            data-testid={`${testIdPrefix}-${t.value}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
