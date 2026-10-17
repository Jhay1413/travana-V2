import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PlanCalc, StepNo } from "../../lib/plan";
import { DriftMessage } from "../shared/drift-message";
import { TARGETS_CARD } from "../shared/targets-styles";

export const STEP_HEAD: Record<StepNo, { title: string; sub: string }> = {
  1: { title: "Set the business target", sub: "Start with the profit the whole business is aiming for this year." },
  2: { title: "Split the target across your shops", sub: "Share the business target between shops. Anything you change is checked against the total." },
  3: { title: "Set targets for each agent", sub: "Share each shop's target between its agents." },
  4: { title: "Review and save", sub: "Check what will change. Nothing is saved until you press Save targets." },
};

export const NEXT_LABEL: Record<StepNo, string> = { 1: "Next: shops", 2: "Next: agents", 3: "Next: review", 4: "Save targets" };

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(TARGETS_CARD, "mb-4 p-5")}>
      <h2 className="mb-3 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function WhoCanChange() {
  return (
    <Panel title="Who can change what">
      <p className="text-[12px] leading-relaxed text-social-muted">
        Owner / Admin sets business and shop targets. Branch Managers set agent targets in their own shop. Homeworkers set their own.
      </p>
    </Panel>
  );
}

const OVERVIEW: Array<[string, string]> = [
  ["Business total", "The yearly profit target for everyone."],
  ["Shops", "Share it between your shops."],
  ["Agents", "Share each shop's target between its agents."],
  ["Review", "See what changes, then save."],
];

export function HowItWorks() {
  return (
    <>
      <Panel title="How this works">
        <ol className="grid gap-3">
          {OVERVIEW.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ticket-amber-bg text-[12px] font-semibold text-ticket-amber-fg">{i + 1}</span>
              <div>
                <div className="text-[13px] font-semibold">{t}</div>
                <div className="text-[12px] text-social-muted">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      <WhoCanChange />
    </>
  );
}

export function AgentsSide({ calc, shopName, onShop }: { calc: PlanCalc; shopName: string; onShop: (branchId: string) => void }) {
  return (
    <>
      <Panel title="Month by month">
        <p className="text-[12px] leading-relaxed text-social-muted">
          Each person&apos;s months follow {shopName}&apos;s busy and quiet weeks, scaled to their yearly target. After you save, change any single month from the Agents tab.
        </p>
      </Panel>
      <Panel title="Shops done">
        <div className="grid">
          {calc.shopRows.map((r, i) => (
            <button
              key={r.branchId}
              type="button"
              onClick={() => onShop(r.branchId)}
              aria-label={`Show ${r.name}`}
              className={cn("flex items-center justify-between gap-2.5 py-2.5 text-left text-[13px]", i > 0 && "border-t border-social-border")}
            >
              <span className="truncate">{r.name}</span>
              <DriftMessage drift={r.count === 0 ? 0 : r.drift} short />
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function ReviewSide() {
  return (
    <>
      <Panel title="What happens when you save">
        <ul className="grid list-disc gap-2 pl-4 text-[12px] leading-relaxed text-social-muted">
          <li>Business, shop and agent targets update straight away.</li>
          <li>Each month follows the old busy and quiet pattern, scaled to the new yearly target.</li>
          <li>Anything you have already set month by month elsewhere is scaled, not thrown away.</li>
        </ul>
      </Panel>
      <WhoCanChange />
    </>
  );
}
