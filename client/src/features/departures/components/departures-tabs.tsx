import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { adjacentTab, type TabCounts } from "../lib/tabs";
import type { DeparturesTab } from "../types";

const TABS: ReadonlyArray<{ value: DeparturesTab; label: string; countLabel: string }> = [
  { value: "tickets", label: "Tickets", countLabel: "still to complete" },
  { value: "balances", label: "Balances", countLabel: "not fully paid" },
];

/** Tickets | Balances underline tabs with count badges (amber, green at zero). Left/Right arrows switch. */
export function DeparturesTabs({
  tab,
  counts,
  onChange,
}: {
  tab: DeparturesTab;
  counts: TabCounts | null;
  onChange: (tab: DeparturesTab) => void;
}) {
  const refs = useRef<Record<DeparturesTab, HTMLButtonElement | null>>({ tickets: null, balances: null });
  const focusAfterSwitch = useRef(false);

  // After an arrow-key switch, move focus to the newly selected tab once the route has changed.
  useEffect(() => {
    if (!focusAfterSwitch.current) return;
    focusAfterSwitch.current = false;
    refs.current[tab]?.focus();
  }, [tab]);

  return (
    <div role="tablist" aria-label="Lists" className="mb-1 flex flex-wrap gap-x-5 gap-y-1.5 border-b border-social-border xl:gap-x-[22px]">
      {TABS.map((t) => {
        const selected = t.value === tab;
        const count = counts?.[t.value];
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`departures-tab-${t.value}`}
            ref={(el) => {
              refs.current[t.value] = el;
            }}
            aria-selected={selected}
            aria-controls="departures-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              focusAfterSwitch.current = true;
              onChange(adjacentTab(tab));
            }}
            data-testid={`tab-departures-${t.value}`}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-2.5 text-[12px] font-semibold transition-colors xl:text-[13px]",
              selected ? "border-social-orange text-social-orange-text" : "border-transparent text-social-muted hover:text-foreground",
            )}
          >
            {t.label}
            {count !== undefined && (
              <span
                aria-label={`${count} ${t.countLabel}`}
                className={cn(
                  "inline-grid h-[22px] min-w-[22px] place-items-center rounded-full px-[7px] text-[12px] font-semibold tabular-nums",
                  count === 0 ? "bg-stage-enquiry-bg text-stage-enquiry-fg" : "bg-stage-inplay-bg text-stage-inplay-fg",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
