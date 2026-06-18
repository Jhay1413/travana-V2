import { Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  dateRangeOptions,
  sortByOptions,
  type DateRange,
  type SortBy,
} from "./_data";
import { formatStatus } from "./helpers";
import { useOpportunities } from "./opportunities-context";

export function SearchBox() {
  const { filters, set } = useOpportunities();
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/40 dark:text-white/40" />
      <Input
        value={filters.search}
        onChange={(e) => set("search", e.target.value)}
        placeholder="Search client or title..."
        className="h-8 pl-8 pr-3 text-xs rounded-xl w-56 bg-black/5 border-0 dark:bg-white/5"
        data-testid="input-opportunities-search"
      />
    </div>
  );
}

export function FilterBar({
  statusOptions,
  total,
  loading,
}: {
  statusOptions: string[];
  total: number;
  loading: boolean;
}) {
  const { filters, set, agents } = useOpportunities();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1 mr-1">
        <Calendar className="h-3 w-3 text-black/40 dark:text-white/40" />
        <span className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">
          Period
        </span>
      </div>
      {dateRangeOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => set("dateRange", opt.value as DateRange)}
          className={`rounded-xl px-2.5 py-1 text-[10px] font-medium transition ${
            filters.dateRange === opt.value
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
          }`}
          data-testid={`button-opportunities-date-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}

      <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />

      <select
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
        data-testid="select-opportunities-status"
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {formatStatus(s)}
          </option>
        ))}
      </select>

      {agents.length > 1 && (
        <select
          value={filters.agentId}
          onChange={(e) => set("agentId", e.target.value)}
          className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
          data-testid="select-opportunities-agent"
        >
          <option value="all">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={filters.sortBy}
        onChange={(e) => set("sortBy", e.target.value as SortBy)}
        className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
        data-testid="select-opportunities-sort"
      >
        {sortByOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="ml-auto text-[10px] text-black/40 dark:text-white/40 tabular-nums">
        {loading ? "Loading..." : `${total} result${total !== 1 ? "s" : ""}`}
      </div>
    </div>
  );
}
