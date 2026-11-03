import type { ReactNode } from "react";
import { StatusPill, gbp } from "@/features/admin-dashboard";
import { MONTH_NAMES, dayKeyOf, formatDay } from "../../lib/dates";
import { branchNames, primaryRoleLabel } from "../../lib/pills";
import type { AgentProfileHeader } from "../../types";

function biggestDealText(header: AgentProfileHeader): string {
  const d = header.biggestDeal;
  if (!d || d.commission <= 0) return "—";
  return d.title ? `${gbp(d.commission)} · ${d.title}` : gbp(d.commission);
}

function bestMonthText(header: AgentProfileHeader): string {
  const b = header.bestMonth;
  if (!b || b.profit <= 0) return "—";
  const month = Number(b.month.slice(5, 7));
  return `${gbp(b.profit)} in ${MONTH_NAMES[month - 1] ?? b.month}`;
}

function Fact({ label, children, wide = false, testId }: { label: string; children: ReactNode; wide?: boolean; testId?: string }) {
  return (
    <div className={wide ? "min-[721px]:col-span-2" : undefined} data-testid={testId}>
      <dt className="text-[12px] text-social-muted xl:text-[13px]">{label}</dt>
      <dd className="m-0 text-[14px] font-semibold leading-snug xl:text-[15px]">{children}</dd>
    </div>
  );
}

export function ProfileFacts({ header }: { header: AgentProfileHeader }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-social-border pt-4 min-[721px]:grid-cols-2 min-[1101px]:grid-cols-4" data-testid="agent-profile-facts">
      <Fact label="Position">{primaryRoleLabel(header.primaryRole)}</Fact>
      <Fact label="Branch">{branchNames(header).join(", ") || "—"}</Fact>
      <Fact label="Started">{formatDay(dayKeyOf(header.startedAt))}</Fact>
      <Fact label="Open deals" testId="fact-open-deals">
        {header.openDeals}
      </Fact>
      <Fact label="Biggest deal" wide testId="fact-biggest-deal">
        {biggestDealText(header)}
      </Fact>
      <Fact label="Best month" testId="fact-best-month">
        {bestMonthText(header)}
      </Fact>
      {header.isSuspended && (
        <Fact label="Account">
          <StatusPill tone="bad">Suspended</StatusPill>
        </Fact>
      )}
    </dl>
  );
}
