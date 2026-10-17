import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import type { HomeworkerOverviewRow } from "@/features/organization/api/organization-overview.api";
import { gbp } from "../lib/money";
import { StatusPill } from "./shared/pills";

const TH = "whitespace-nowrap px-3 pb-2.5 text-[12px] font-semibold text-social-muted xl:text-[13px]";
const TD = "border-b border-social-border px-3 py-2.5 text-[13px] xl:text-[14px]";

function shareLabel(v: number | null): string {
  return v === null ? "–" : `${Number(v.toFixed(2))}%`;
}

/** Compact homeworker summary. Renders nothing when the organisation has no homeworkers. */
export function HomeworkersCard({ rows, className }: { rows: HomeworkerOverviewRow[] | undefined; className?: string }) {
  if (!rows || rows.length === 0) return null;
  return (
    <HomeCard title="Homeworkers" className={className} testId="card-homeworkers-overview">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-social-border">
              <th scope="col" className={`${TH} text-left`}>
                Homeworker
              </th>
              <th scope="col" className={`${TH} text-left`}>
                Owner
              </th>
              {["Share", "Status", "This month", "Bookings", "Target", "Achieved"].map((h) => (
                <th key={h} scope="col" className={`${TH} text-right`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branchId} data-testid={`row-homeworker-overview-${r.branchId}`}>
                <td className={`${TD} font-semibold`}>{r.name}</td>
                <td className={TD}>{r.ownerName ?? "–"}</td>
                <td className={`${TD} text-right tabular-nums`}>{shareLabel(r.profitSharePercent)}</td>
                <td className={`${TD} text-right`}>
                  <StatusPill tone={r.status === "active" ? "good" : "plain"} className="capitalize">
                    {r.status}
                  </StatusPill>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{gbp(r.month)}</td>
                <td className={`${TD} text-right tabular-nums`}>{r.rangeBookings}</td>
                <td className={`${TD} text-right tabular-nums`}>{gbp(r.target)}</td>
                <td className={`${TD} text-right tabular-nums`}>{r.target > 0 ? `${Math.round(r.achievedPercent)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HomeCard>
  );
}
