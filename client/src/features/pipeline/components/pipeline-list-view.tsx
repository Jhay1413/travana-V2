import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DashboardCard, InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import type { Transaction } from "@/features/quote/types";
import {
  PRIORITY_META,
  formatCurrency,
  formatDate,
  formatDueDateTime,
  getAssigneeName,
  getDestinationName,
  getTimeAgo,
  getTransactionDate,
  getTransactionProfit,
  getTransactionTitle,
  getTransactionValue,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";

export interface PipelineListItem {
  transaction: Transaction;
  stage: PipelineStage;
}

type SortField = "client" | "title" | "stage" | "value" | "profit" | "date" | "agent";
type SortDir = "asc" | "desc";

export function PipelineListView({
  items,
  getClientName,
  isLoading,
  onRowClick,
}: {
  items: PipelineListItem[];
  getClientName: (id: string | null) => string;
  isLoading: boolean;
  onRowClick: (t: Transaction, stage: PipelineStage) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(f);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortField) {
        case "client": va = getClientName(a.transaction.client_id); vb = getClientName(b.transaction.client_id); break;
        case "title": va = getTransactionTitle(a.transaction); vb = getTransactionTitle(b.transaction); break;
        case "stage": va = a.stage; vb = b.stage; break;
        case "value": va = getTransactionValue(a.transaction); vb = getTransactionValue(b.transaction); break;
        case "profit": va = getTransactionProfit(a.transaction); vb = getTransactionProfit(b.transaction); break;
        case "date": va = getTransactionDate(a.transaction) || ""; vb = getTransactionDate(b.transaction) || ""; break;
        case "agent": va = getAssigneeName(a.transaction); vb = getAssigneeName(b.transaction); break;
      }
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [items, sortField, sortDir, getClientName]);

  const SortHeader = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`cursor-pointer select-none px-3 py-2.5 3xl:px-4 3xl:py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-black/50 hover:text-black/70 ${className}`}
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </div>
    </th>
  );

  if (isLoading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <DashboardCard className="mx-4 mt-4 overflow-hidden !p-0 3xl:mx-6">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="pipeline-list-table">
          <thead className="border-b border-black/10 bg-black/[0.02]">
            <tr>
              <SortHeader field="client" label="Client" />
              <SortHeader field="title" label="Deal" />
              <SortHeader field="stage" label="Stage" />
              <SortHeader field="value" label="Value" />
              <SortHeader field="profit" label="Profit" />
              <th className="px-3 py-2.5 3xl:px-4 3xl:py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-black/50">Priority</th>
              <th className="px-3 py-2.5 3xl:px-4 3xl:py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-black/50">Next task</th>
              <SortHeader field="date" label="Travel Date" />
              <SortHeader field="agent" label="Agent" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {sorted.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-sm text-gray-400">No transactions found</td></tr>
            ) : sorted.map(({ transaction: tx, stage }) => {
              const value = getTransactionValue(tx);
              const profit = getTransactionProfit(tx);
              const dest = getDestinationName(tx);
              const priority = PRIORITY_META[tx.priority || "low"];
              return (
                <tr
                  key={tx.id}
                  className="cursor-pointer transition-colors hover:bg-black/[0.02]"
                  onClick={() => onRowClick(tx, stage)}
                  data-testid={`list-row-${tx.id}`}
                >
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    <div className="flex items-center gap-2">
                      <InitialsAvatar name={getClientName(tx.client_id)} className="h-7 w-7" />
                      <span className="max-w-[160px] truncate text-xs 3xl:text-[13px] font-semibold text-gray-900">{getClientName(tx.client_id)}</span>
                      <span className="shrink-0 text-[11px] text-gray-400">{getTimeAgo(tx.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    <div>
                      <p className="max-w-[180px] truncate text-xs 3xl:text-[13px] font-medium text-gray-800">{getTransactionTitle(tx)}</p>
                      {dest && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400"><MapPin className="h-3 w-3" />{dest}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    <span className="inline-flex items-center rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black/70">{stage === "In Play" ? "In Play" : stage}</span>
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3"><span className="text-xs 3xl:text-[13px] font-bold text-gray-900">{value > 0 ? formatCurrency(value) : "TBC"}</span></td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3"><span className="text-xs 3xl:text-[13px] font-semibold text-[#22a06b]">{profit > 0 ? formatCurrency(profit) : "—"}</span></td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-black/70">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color }} />
                      {priority.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    {tx.next_task ? (
                      <div>
                        <p className="max-w-[160px] truncate text-[12px] text-black/70">{tx.next_task.title || "Untitled task"}</p>
                        <p className="text-[11px] text-black/40">{formatDueDateTime(tx.next_task.due_date)}</p>
                      </div>
                    ) : (
                      <span className="text-[12px] text-black/30">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3"><span className="text-xs 3xl:text-[13px] text-gray-600">{formatDate(getTransactionDate(tx))}</span></td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3">
                    <div className="flex items-center gap-1.5">
                      <InitialsAvatar name={getAssigneeName(tx)} solid className="h-5 w-5" />
                      <span className="text-[12px] text-gray-600">{getAssigneeName(tx)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 3xl:px-4 3xl:py-3"><ChevronRight className="h-4 w-4 text-gray-300" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}
