import { MEASURES, changeText, formatMeasure, type ChangeTone } from "../lib/compare-copy";
import type { OrganizationOverviewCompare } from "../types";
import { StatusPill, type PillTone } from "./shared/pills";

const TONE: Record<ChangeTone, PillTone> = { up: "good", down: "warn", none: "plain" };
const TH = "whitespace-nowrap px-3 pb-2.5 text-[12px] font-semibold text-social-muted xl:text-[13px]";
const TD = "border-b border-social-border px-3 py-3 text-[13px] xl:text-[14px]";

export function CompareTable({ data }: { data: OrganizationOverviewCompare }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse" data-testid="table-compare">
        <caption className="sr-only">
          Profit, bookings, profit per booking and close rate: {data.labels.now} against {data.labels.other}
        </caption>
        <thead>
          <tr className="border-b border-social-border">
            <th scope="col" className={`${TH} text-left`}>
              Measure
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {data.labels.now}
            </th>
            <th scope="col" className={`${TH} text-right`}>
              {data.labels.other}
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {MEASURES.map(({ key, label }) => {
            const change = changeText(key, data.now[key], data.other[key]);
            return (
              <tr key={key} data-testid={`row-compare-${key}`}>
                <th scope="row" className={`${TD} text-left font-semibold`}>
                  {label}
                </th>
                <td className={`${TD} text-right tabular-nums`}>{formatMeasure(key, data.now[key])}</td>
                <td className={`${TD} text-right tabular-nums`}>{formatMeasure(key, data.other[key])}</td>
                <td className={TD}>
                  <StatusPill tone={TONE[change.tone]}>{change.text}</StatusPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
