import { DashboardCard } from "@/features/agent-overview/components/dashboard-ui";
import type { TourOperatorBreakdownRow } from "@/features/organization/api/organization-overview.api";
import { currency } from "./helpers";

const HEAD = "py-2 text-[11px] font-medium text-[#7c98b0] first:rounded-l-md first:pl-3 last:rounded-r-md last:pr-3";

export function TourOperatorLeagueCard({ rows }: { rows: TourOperatorBreakdownRow[] }) {
  const top = [...rows].sort((a, b) => b.commission - a.commission).slice(0, 10);

  return (
    <DashboardCard className="min-w-0" testId="card-tour-operator-league">
      <div className="text-lg font-semibold">Tour Operator League</div>
      {top.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No bookings this month.</div>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
              <th className={`${HEAD} text-left`}>Name</th>
              <th className={`${HEAD} text-right`}>Bookings</th>
              <th className={`${HEAD} text-right`}>Comm.</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r, i) => (
              <tr key={r.id} className="border-t border-black/5 dark:border-white/10" data-testid={`row-tour-operator-${r.id}`}>
                <td className="py-2 pr-2">
                  <span className="font-semibold text-[#fe9a00]">{i + 1}.</span> {r.name}
                </td>
                <td className="py-2 text-right">{r.bookings}</td>
                <td className="py-2 text-right">{currency.format(r.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardCard>
  );
}
