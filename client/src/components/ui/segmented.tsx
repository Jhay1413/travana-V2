import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Segmented-control look shared by Social Posts, the Inbox and the Pipeline. */
export const SEGMENTED =
  "flex h-10 w-auto justify-start gap-1 rounded-[10px] border border-social-border bg-[#F1F4F8] p-[3px] dark:bg-muted";
export const SEGMENT_ITEM =
  "h-full min-w-0 gap-[7px] rounded-lg px-4 text-[13px] font-semibold text-social-muted data-[state=on]:bg-card data-[state=on]:text-social-orange-text data-[state=on]:shadow-[0_1px_3px_rgba(30,41,59,.15)]";

const BLACK_ITEM =
  "px-3 text-[12px] xl:px-4 xl:text-[13px] data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-none";

export interface SegmentedItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  testId?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: Array<SegmentedItem<T>>;
  /** Fixed control height; omit for the default 40px. */
  height?: 38 | 42;
  /** "black" gives the active segment a black fill (redesigned page headers). */
  variant?: "default" | "black";
  label?: string;
  className?: string;
  itemClassName?: string;
  /**
   * How counts render: "pill" (default) a small translucent pill; "plain" muted text;
   * "amber" a white pill that turns amber on the active segment (the holidays rail).
   * "amber-solid" an always-amber pill (client dashboard Views).
   */
  countVariant?: "pill" | "plain" | "amber" | "amber-solid";
}

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  height,
  variant = "default",
  label,
  className,
  itemClassName,
  countVariant = "pill",
}: SegmentedProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        // Radix emits "" when the active item is clicked again; keep the selection.
        const match = items.find((i) => i.value === next);
        if (match) onChange(match.value);
      }}
      className={cn(SEGMENTED, height === 42 && "h-[42px]", height === 38 && "h-[38px]", className)}
    >
      {items.map((item) => (
        <ToggleGroupItem
          key={item.value}
          value={item.value}
          data-testid={item.testId}
          className={cn("group", SEGMENT_ITEM, variant === "black" && BLACK_ITEM, itemClassName)}
        >
          {item.icon}
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                countVariant === "pill" && "rounded-full bg-black/5 px-1.5 dark:bg-white/10",
                countVariant === "plain" && "text-social-muted group-data-[state=on]:text-inherit",
                countVariant === "amber-solid" && "rounded-full bg-[#FEF3C7] px-1.5 text-[#92400E]",
                countVariant === "amber" &&
                  "rounded-full bg-card px-1.5 text-social-muted group-data-[state=on]:bg-stage-inplay-bg group-data-[state=on]:text-stage-inplay-fg",
              )}
            >
              {item.count}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
