import type { ChartMonth } from "../lib/chart-model";
import { StatusPill } from "./shared/pills";

const TH = "whitespace-nowrap px-3 pb-2.5 text-[12px] font-semibold text-social-muted xl:text-[13px]";
const TD = "border-b border-social-border px-3 py-2.5 text-[13px] xl:text-[14px]";

export function CommissionTable({ months, year }: { months: ChartMonth[]; year: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse" data-testid="table-commission">
        <caption className="sr-only">Commission against target by month, {year}</caption>
        <thead>
          <tr className="border-b border-social-border">
            <th scope="col" className={`${TH} text-left`}>
              Month
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Commission
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Target
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month} data-testid={`row-commission-${m.month}`}>
              <td className={TD}>{m.name}</td>
              <td className={`${TD} text-right tabular-nums`}>{m.commissionText}</td>
              <td className={`${TD} text-right tabular-nums`}>{m.targetText}</td>
              <td className={TD}>
                <StatusPill tone={m.tone === "good" ? "good" : m.tone === "warn" ? "warn" : "plain"}>{m.result}</StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
