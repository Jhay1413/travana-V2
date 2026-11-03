import { cn } from "@/lib/utils";
import type { ProfileMonthRow } from "../../lib/chart-model";
import { TD, TH } from "../shared/profile-bits";

export function MonthlyTable({ rows, year, noun }: { rows: ProfileMonthRow[]; year: number; noun: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse" data-testid="table-monthly-profit">
        <caption className="sr-only">Profit earned each month in {year} and share of the {noun}'s profit</caption>
        <thead>
          <tr className="border-b border-social-border">
            <th scope="col" className={`${TH} text-left`}>
              Month
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Profit
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Share of {noun} profit
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className={cn(r.shaded && "bg-social-navy/[0.06]")} data-testid={`row-monthly-${r.month}`}>
              <td className={TD}>
                {r.name}
                {r.shaded && <span className="sr-only"> (in the selected period)</span>}
              </td>
              <td className={`${TD} text-right tabular-nums`}>{r.profitText}</td>
              <td className={`${TD} text-right tabular-nums`}>{r.shareText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
