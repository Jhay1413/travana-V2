import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOrganizationAgentsPerformance } from "@/hooks/queries";
import type {
  AgentPerformanceRange,
  AgentPerformanceRow,
} from "@/api/endpoints/organization-overview.api";
import { currency } from "./helpers";

type SortKey =
  | "name"
  | "today"
  | "week"
  | "month"
  | "avgPerBooking"
  | "target"
  | "achievedPercent";
type SortDir = "asc" | "desc";

const RANGE_OPTIONS: { value: AgentPerformanceRange; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Date Range" },
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatDateInput(d?: Date): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground",
          align === "right" ? "ml-auto" : "",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        data-testid={`sort-header-${sortKey}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  );
}

function AchievedBar({ percent }: { percent: number }) {
  const capped = Math.min(100, Math.max(0, percent));
  const over = percent > 100;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", over ? "bg-emerald-500" : "bg-blue-500")}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className="tabular-nums text-xs font-semibold">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

export function AgentsPerformanceCard() {
  const [range, setRange] = useState<AgentPerformanceRange>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>("month");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const params = useMemo(() => {
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      return {
        range: "custom" as const,
        from: dateRange.from.toISOString().slice(0, 10),
        to: dateRange.to.toISOString().slice(0, 10),
      };
    }
    return { range: range === "custom" ? ("month" as const) : range };
  }, [range, dateRange]);

  const { data, isLoading, isError } = useOrganizationAgentsPerformance(params);

  const sortedRows = useMemo<AgentPerformanceRow[]>(() => {
    const rows = data?.rows ?? [];
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <Card
      className="glass ringed grain rounded-2xl p-4 md:p-5"
      data-testid="agents-performance-card"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-blue-500" aria-hidden />
            Agents Performance
          </div>
          <div className="text-xs text-muted-foreground">
            Compare commission across the whole agency
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="agents-performance-filter"
        >
          <div className="inline-flex rounded-lg border bg-background p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                data-testid={`agents-range-${opt.value}`}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition",
                  range === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === "custom" ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  data-testid="agents-range-picker-trigger"
                >
                  <CalendarRange className="h-3.5 w-3.5" />
                  {dateRange?.from && dateRange?.to
                    ? `${formatDateInput(dateRange.from)} – ${formatDateInput(dateRange.to)}`
                    : "Pick a date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto p-0"
                data-testid="agents-range-picker-popover"
              >
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto" data-testid="agents-performance-table-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader
                label="Agent"
                sortKey="name"
                active={sortKey === "name"}
                dir={sortDir}
                onSort={onSort}
                align="left"
              />
              <SortHeader
                label="Today"
                sortKey="today"
                active={sortKey === "today"}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="This Week"
                sortKey="week"
                active={sortKey === "week"}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="This Month"
                sortKey="month"
                active={sortKey === "month"}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Avg. PPB"
                sortKey="avgPerBooking"
                active={sortKey === "avgPerBooking"}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Target"
                sortKey="target"
                active={sortKey === "target"}
                dir={sortDir}
                onSort={onSort}
              />
              <SortHeader
                label="Achieved %"
                sortKey="achievedPercent"
                active={sortKey === "achievedPercent"}
                dir={sortDir}
                onSort={onSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} data-testid={`agents-row-skeleton-${idx}`}>
                  {Array.from({ length: 7 }).map((__, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-xs text-rose-500"
                  data-testid="agents-performance-error"
                >
                  Couldn't load agents performance.
                </TableCell>
              </TableRow>
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-xs text-muted-foreground"
                  data-testid="agents-performance-empty"
                >
                  No agent activity in the selected range.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.id} data-testid={`agents-row-${row.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {row.avatarUrl ? (
                          <AvatarImage src={row.avatarUrl} alt={row.name} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {initialsFor(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium" data-testid={`agents-name-${row.id}`}>
                        {row.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`agents-today-${row.id}`}>
                    {currency.format(row.today)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`agents-week-${row.id}`}>
                    {currency.format(row.week)}
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums font-semibold"
                    data-testid={`agents-month-${row.id}`}
                  >
                    {currency.format(row.month)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`agents-ppb-${row.id}`}>
                    {currency.format(row.avgPerBooking)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`agents-target-${row.id}`}>
                    {row.target > 0 ? currency.format(row.target) : "—"}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`agents-achieved-${row.id}`}>
                    {row.target > 0 ? (
                      <AchievedBar percent={row.achievedPercent} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
