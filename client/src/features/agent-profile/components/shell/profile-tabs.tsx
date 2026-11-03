import { useEffect, useRef, type KeyboardEvent } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROFILE_TABS } from "../../lib/profile-tabs";
import type { ProfileTab } from "../../types";

/** Underline tabs; scroll sideways on narrow screens and keep the selected tab in view. */
export function ProfileTabs({ value, onChange }: { value: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  const selected = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = PROFILE_TABS.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    const tab = PROFILE_TABS[next].value;
    onChange(tab);
    window.setTimeout(() => document.getElementById(`profile-tab-${tab}`)?.focus(), 0);
  };

  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="flex gap-1 overflow-x-auto border-b border-social-border"
      data-testid="agent-profile-tabs"
    >
      {PROFILE_TABS.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={active ? selected : undefined}
            type="button"
            role="tab"
            id={`profile-tab-${t.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            aria-controls="profile-tabpanel"
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-[3px] px-3.5 py-3 text-[13px] font-semibold transition-colors xl:px-4 xl:text-[14px]",
              active ? "border-social-navy text-social-navy" : "border-transparent text-social-muted hover:bg-muted hover:text-foreground",
            )}
            data-testid={`tab-agent-profile-${t.value}`}
          >
            {t.label}
            {t.locked && (
              <>
                <Lock className="h-4 w-4" aria-hidden />
                <span className="sr-only">, managers only</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
