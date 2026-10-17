import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { gbp, parseMoney } from "../../lib/money";
import type { PlanConflict } from "../../lib/plan";

const show = (raw: string): string => {
  const r = parseMoney(raw);
  return r.ok ? gbp(r.value) : raw || "nothing";
};

interface ConflictsNoticeProps {
  conflicts: PlanConflict[];
  onResolve: (conflict: PlanConflict, choice: "mine" | "latest") => void;
}

/** Someone else changed a target the person has also edited since they started; they choose whose number wins. */
export function ConflictsNotice({ conflicts, onResolve }: ConflictsNoticeProps) {
  if (conflicts.length === 0) return null;
  return (
    <div className="mb-5 space-y-2.5 rounded-xl bg-ticket-amber-bg px-4 py-3.5" role="alert" data-testid="wizard-conflicts">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ticket-amber-fg">
        <AlertTriangle className="h-4 w-4" />
        Some targets changed while you were working
      </div>
      {conflicts.map((c) => (
        <div key={`${c.kind}-${c.id}`} className="flex flex-wrap items-center justify-between gap-3 text-[13px]" data-testid={`conflict-${c.kind}-${c.id}`}>
          <span>
            <b className="font-semibold">{c.name}</b> was changed by someone else since you started (was {show(c.started)}, now {show(c.latest)}). You set {show(c.mine)}.
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={() => onResolve(c, "mine")}>
              Keep mine
            </Button>
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={() => onResolve(c, "latest")}>
              Use latest
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}
