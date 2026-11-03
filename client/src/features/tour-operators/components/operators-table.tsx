import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgOperatorRow, SortKey, SortState } from "../types";
import { TH } from "./classes";
import { OperatorRow } from "./operator-row";
import type { RowContext } from "./row-context";

function SortHeader({ label, sortKey, sort, onSort, right }: { label: string; sortKey: SortKey; sort: SortState; onSort: (k: SortKey) => void; right?: boolean }) {
  const active = sort.key === sortKey;
  const Icon = active && sort.dir === -1 ? ArrowDown : ArrowUp;
  return (
    <th scope="col" className={cn(TH, right && "text-right")} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 font-semibold hover:text-foreground", right && "ml-auto")} data-testid={`sort-${sortKey}`}>
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

interface OperatorsTableProps {
  rows: OrgOperatorRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  ctx: RowContext;
}

/** Desktop list (wider than 900px). */
export function OperatorsTable({ rows, sort, onSort, ctx }: OperatorsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <caption className="sr-only">Tour operators with phone, website, login and commission rate</caption>
        <thead>
          <tr>
            <SortHeader label="Tour Operator" sortKey="name" sort={sort} onSort={onSort} />
            <th scope="col" className={TH}>Phone</th>
            <th scope="col" className={TH}>Weblink</th>
            <th scope="col" className={TH}>Username</th>
            <th scope="col" className={TH}>Password</th>
            <SortHeader label="Commission Rate" sortKey="commission" sort={sort} onSort={onSort} right />
            <th scope="col" className={cn(TH, "text-right")}>Balance Due</th>
            {ctx.canWrite && (
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OperatorRow key={row.linkId} row={row} ctx={ctx} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
