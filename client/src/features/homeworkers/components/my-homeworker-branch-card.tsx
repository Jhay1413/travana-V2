import { Link } from "wouter";
import { DashboardCard } from "@/features/agent-overview/components/dashboard-ui";
import { useHomeworkerMe } from "../api/use-homeworker-queries";
import { useMyHomeworkerStatement } from "../api/use-statement-queries";
import { formatProfitShare } from "../lib/profit-share";
import { currentMonth, displayFigures, formatMoney, monthLabel, monthPeriod } from "../lib/statement";

/** Homeworker's own branch, share and current-month statement summary. Hidden when /homeworkers/me fails (404). */
export function MyHomeworkerBranchCard() {
  const { data } = useHomeworkerMe();
  const month = currentMonth();
  const { from, to } = monthPeriod(month);
  const statement = useMyHomeworkerStatement(from, to, { enabled: !!data });
  if (!data) return null;

  const figures = statement.data ? displayFigures(statement.data) : null;

  return (
    <DashboardCard className="min-w-0" testId="card-my-homeworker-branch">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">My homeworker branch</div>
      <div className="mt-1 text-lg font-semibold">{data.name}</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Profit share: <span className="font-medium text-foreground">{formatProfitShare(data.profitSharePercent)}</span>
      </div>
      {figures && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm" data-testid="card-my-statement-summary">
          <div>
            <div className="text-[11px] text-muted-foreground">{monthLabel(month)} gross</div>
            <div className="font-semibold">{formatMoney(figures.gross)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">My share</div>
            <div className="font-semibold">{formatMoney(figures.homeworkerShare)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Bookings</div>
            <div className="font-semibold">{statement.data?.bookingCount ?? 0}</div>
          </div>
        </div>
      )}
      <Link href="/my-statement" className="mt-3 inline-block text-sm font-medium text-[#fe9a00] hover:underline" data-testid="link-my-statement">
        View my statement
      </Link>
    </DashboardCard>
  );
}
