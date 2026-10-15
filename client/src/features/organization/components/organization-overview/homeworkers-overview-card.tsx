import { DashboardCard } from "@/features/agent-overview/components/dashboard-ui";
import { currency } from "./helpers";
import type { HomeworkerOverviewRow } from "../../api/organization-overview.api";

const HEAD = "py-2 text-[11px] font-medium text-[#7c98b0] first:pl-3 last:pr-3";

function shareLabel(v: number | null): string {
  return v === null ? "–" : `${Number(v.toFixed(2))}%`;
}

export function HomeworkersOverviewCard({ rows }: { rows: HomeworkerOverviewRow[] | undefined }) {
  if (!rows || rows.length === 0) return null;
  return (
    <DashboardCard className="min-w-0" testId="card-homeworkers-overview">
      <div className="text-lg font-semibold">Homeworkers</div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
              <th className={`${HEAD} text-left`}>Homeworker</th>
              <th className={`${HEAD} text-left`}>Owner</th>
              {["Share", "Status", "This Month", "Bookings", "Target", "Achieved"].map((h) => (
                <th key={h} className={`${HEAD} whitespace-nowrap pl-3 text-right`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branchId} className="border-t border-black/5 dark:border-white/10" data-testid={`row-homeworker-overview-${r.branchId}`}>
                <td className="py-2 pl-3 font-semibold">{r.name}</td>
                <td className="py-2 pr-2">{r.ownerName ?? "–"}</td>
                <td className="py-2 pl-3 text-right">{shareLabel(r.profitSharePercent)}</td>
                <td className="py-2 pl-3 text-right capitalize">{r.status}</td>
                <td className="py-2 pl-3 text-right">{currency.format(r.month)}</td>
                <td className="py-2 pl-3 text-right">{r.rangeBookings}</td>
                <td className="py-2 pl-3 text-right">{currency.format(r.target)}</td>
                <td className="py-2 pl-3 text-right">{r.target > 0 ? `${Math.round(r.achievedPercent)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
