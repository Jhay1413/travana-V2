import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";
import { homeworkersTotal } from "../../lib/allocation";
import { changeRows, changedRows } from "../../lib/plan";
import { gbp } from "../../lib/money";
import type { Plan, TargetsYear } from "../../types";
import { ToneMessage } from "../shared/drift-message";

interface StepReviewProps {
  data: TargetsYear;
  plan: Plan;
  onlyChanges: boolean;
  onOnlyChanges: (value: boolean) => void;
}

const COLS = "grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(90px,1fr))] items-center gap-3";

export function StepReview({ data, plan, onlyChanges, onOnlyChanges }: StepReviewProps) {
  const rows = changeRows(plan, data);
  const changed = changedRows(rows);
  const shown = onlyChanges && changed.length > 0 ? changed : rows;
  const groups = Array.from(new Set(shown.map((r) => r.group)));
  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[15px] font-semibold" data-testid="wizard-change-count">
          {changed.length === 0 ? "Nothing changes" : `${changed.length} ${changed.length === 1 ? "target changes" : "targets change"}`}
        </div>
        {changed.length > 0 && (
          <label className="inline-flex items-center gap-2.5 text-[13px] text-social-muted">
            Only show changes
            <Switch checked={onlyChanges} onCheckedChange={onOnlyChanges} aria-label="Only show changes" data-testid="switch-only-changes" />
          </label>
        )}
      </div>
      {changed.length === 0 && (
        <div className="mb-3.5">
          <ToneMessage tone="ok">Your plan matches what is saved. You can go back and change something, or save to finish.</ToneMessage>
        </div>
      )}
      <div className={cn(COLS, "rounded-[10px] bg-muted/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted")}>
        <div>Target</div>
        <div className="text-right">Now</div>
        <div className="text-right">After</div>
        <div className="text-right">Change</div>
      </div>
      {groups.map((g) => (
        <div key={g}>
          {g !== "Business" && <div className="px-4 pb-1 pt-3.5 text-[12px] font-semibold text-social-muted">{g === "Shops" ? "Shops" : `${g} agents`}</div>}
          {shown
            .filter((r) => r.group === g)
            .map((r) => {
              const d = r.after - r.before;
              return (
                <div key={r.key} data-testid={`review-row-${r.key}`} className={cn(COLS, "border-b border-social-border px-4 py-2.5 text-[14px]")}>
                  <div className={cn("flex min-w-0 items-center gap-2.5", d !== 0 && "font-semibold")}>
                    {r.kind === "agent" && <PersonAvatar name={r.name} size={24} />}
                    <span className="truncate">{r.name}</span>
                  </div>
                  <div className="text-right tabular-nums text-social-muted">{gbp(r.before)}</div>
                  <div className={cn("text-right tabular-nums", d !== 0 && "font-semibold")}>{gbp(r.after)}</div>
                  <div className={cn("text-right tabular-nums", d === 0 ? "text-social-muted" : d > 0 ? "font-semibold text-status-scheduled-fg" : "font-semibold text-ticket-amber-fg")}>
                    {d === 0 ? "No change" : `${d > 0 ? "+" : "−"}${gbp(Math.abs(d))}`}
                  </div>
                </div>
              );
            })}
        </div>
      ))}
      <div className="mt-4 flex items-center gap-2.5 text-[13px] text-social-muted">
        <Lock className="h-3.5 w-3.5" />
        Homeworkers keep the targets they set for themselves ({gbp(homeworkersTotal(data))} in total).
      </div>
    </div>
  );
}
