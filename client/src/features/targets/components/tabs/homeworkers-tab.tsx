import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { businessTotal, homeworkersTotal, profitSoFar } from "../../lib/allocation";
import { ownTarget } from "../../lib/homeworker";
import { gbp } from "../../lib/money";
import { sum } from "../../lib/months";
import { paceStatus, percentOf } from "../../lib/status";
import type { HomeworkerYear, TargetsYear } from "../../types";
import { ProgressBar } from "../shared/progress-bar";
import { StatTile } from "../shared/stat-tiles";
import { StatusPill } from "../shared/status-pill";
import { TARGETS_CARD, TARGETS_TH } from "../shared/targets-styles";

interface HomeworkersTabProps {
  data: TargetsYear;
  onOverride: (homeworker: HomeworkerYear) => void;
}

export function HomeworkersTab({ data, onOverride }: HomeworkersTabProps) {
  const [info, setInfo] = useState(false);
  const target = homeworkersTotal(data);
  const profit = sum(data.homeworkers.map((h) => profitSoFar(h.actual, data.currentMonth)));
  const canOverride = data.canEdit.homeworkers;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <StatTile label="Homeworker targets" value={gbp(target)} sub="Included in the business target" />
        <StatTile label="Profit so far" value={gbp(profit)} sub={`${percentOf(profit, target)}% of their targets`} />
        <StatTile label="Share of business" value={`${percentOf(target, businessTotal(data))}%`} sub={`${gbp(target)} of ${gbp(businessTotal(data))}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ticket-amber-bg px-5 py-3.5">
        <div>
          <div className="text-[13px] font-semibold">Homeworkers set their own targets</div>
          <div className="text-[12px] text-social-muted">You can see them here and override one if needed. They will see it was set by an admin.</div>
        </div>
        <button type="button" onClick={() => setInfo(true)} className="text-[14px] font-semibold text-social-orange-text hover:underline">
          How overrides work
        </button>
      </div>

      <section className={cn(TARGETS_CARD, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-social-border bg-muted/40">
                <th className={TARGETS_TH}>Homeworker</th>
                <th className={TARGETS_TH}>Yearly target</th>
                <th className={TARGETS_TH}>Profit so far</th>
                <th className={TARGETS_TH}>Progress to target</th>
                <th className={TARGETS_TH}>Status</th>
                <th className={TARGETS_TH}>Set by</th>
                <th className={TARGETS_TH} />
              </tr>
            </thead>
            <tbody>
              {data.homeworkers.map((h) => {
                const t = sum(h.months);
                const p = profitSoFar(h.actual, data.currentMonth);
                const overridden = h.source === "admin";
                return (
                  <tr key={h.userId} className="border-b border-social-border last:border-b-0" data-testid={`homeworker-row-${h.userId}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={h.name} size={36} />
                        <div>
                          <div className="font-semibold">{h.name}</div>
                          <div className="text-[12px] text-social-muted">{overridden ? `Their own target was ${gbp(ownTarget(h))}` : "Set by themselves"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{gbp(t)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {gbp(p)}
                      <div className="text-[12px] text-social-muted">{percentOf(p, t)}%</div>
                    </td>
                    <td className="w-[22%] px-4 py-3">
                      <ProgressBar profit={p} target={t} elapsed={data.elapsed} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={paceStatus(p, t, data.elapsed)} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", overridden ? "bg-ticket-amber-bg text-ticket-amber-fg" : "bg-muted text-social-muted")}>
                        {overridden ? "Admin override" : "Self-set"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canOverride && (
                        <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={() => onOverride(h)} aria-label={`Override target for ${h.name}`}>
                          Override
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.homeworkers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-social-muted">
                    No homeworkers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="max-w-[480px] rounded-2xl border-social-border p-6 sm:rounded-2xl">
          <DialogTitle className="text-[18px] font-semibold">How overrides work</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-social-muted">
            A homeworker sets their own yearly and monthly target. As Owner / Admin you can replace it with an admin target and leave a note. They will see that it was set by an admin and why. You can revert to their own target at any time, and nothing they entered is lost.
          </DialogDescription>
          <div className="flex justify-end">
            <Button type="button" className={PRIMARY_ACTION} onClick={() => setInfo(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
