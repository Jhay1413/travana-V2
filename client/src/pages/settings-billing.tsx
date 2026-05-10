import { useRole } from "@/hooks/use-role";
import { useAgency, useTeam, PLAN_DETAILS, type AgencyPlan } from "@/hooks/use-agency";
import { AlertCircle, CreditCard, Users, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SettingsBillingPage() {
  const { role, setRole, can } = useRole();
  const { agency, updateAgency } = useAgency();
  const { team } = useTeam();
  const allowed = can("admin", "billing");

  const seatsUsed = team.filter((m) => m.status !== "suspended").length;
  const seatPct = Math.min(100, Math.round((seatsUsed / agency.seatLimit) * 100));

  const switchPlan = (p: AgencyPlan) => {
    updateAgency({ plan: p, seatLimit: PLAN_DETAILS[p].seats });
  };

  return (
    <>
      {!allowed ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <div className="font-semibold">Owner access only</div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">Current plan</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold">{PLAN_DETAILS[agency.plan].label}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                </div>
                <div className="mt-1 text-sm text-black/60 dark:text-white/60">£{PLAN_DETAILS[agency.plan].pricePerMonth} / month · billed monthly</div>
              </div>
              <Button variant="outline" disabled data-testid="button-manage-billing">
                <CreditCard className="mr-1 h-4 w-4" /> Manage billing (coming soon)
              </Button>
            </div>

            <div className="mt-6 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.02]">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> Seats used
                </div>
                <span className="text-sm font-semibold">{seatsUsed} / {agency.seatLimit}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${seatPct}%`, background: agency.brandColor }} data-testid="bar-seat-usage" />
              </div>
              {seatPct >= 80 && <div className="mt-2 text-xs text-amber-700">You're approaching your seat limit. Consider upgrading.</div>}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Upgrade or change plan</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.keys(PLAN_DETAILS) as AgencyPlan[]).map((p) => {
                const d = PLAN_DETAILS[p];
                const isCurrent = agency.plan === p;
                return (
                  <div key={p} className={cn("rounded-2xl border p-5", isCurrent ? "border-blue-500 bg-blue-500/5" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5")} data-testid={`card-plan-${p}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold">{d.label}</span>
                      {p === "growth" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700"><Sparkles className="h-3 w-3" /> Popular</span>}
                    </div>
                    <div className="mb-3"><span className="text-2xl font-bold">£{d.pricePerMonth}</span><span className="text-xs text-black/55 dark:text-white/55">/mo</span></div>
                    <ul className="mb-4 space-y-1 text-xs text-black/65 dark:text-white/65">
                      {d.features.map((f) => <li key={f} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" /> {f}</li>)}
                    </ul>
                    {isCurrent ? (
                      <Button disabled className="w-full" variant="outline">Current plan</Button>
                    ) : (
                      <Button onClick={() => switchPlan(p)} className="w-full" style={{ background: agency.brandColor }} data-testid={`button-switch-plan-${p}`}>Switch to {d.label}</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
