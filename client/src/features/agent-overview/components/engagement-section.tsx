import { useMemo, useState } from "react";
import { ChevronRight, View } from "lucide-react";
import { useLocation } from "wouter";
import { useRecentQuoteEngagement } from "@/hooks/queries";
import { DashboardCard, SegmentedTabs, timeAgo } from "./dashboard-ui";

type EngagementFilter = "today" | "yesterday" | "week" | "all";

const TABS: Array<{ value: EngagementFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All" },
];

// Returns true when `iso` falls within the selected time window (based on the
// viewer's local calendar day).
function matchesFilter(iso: string, filter: EngagementFilter): boolean {
  if (filter === "all") return true;
  const viewed = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  const t = viewed.getTime();
  if (filter === "today") return t >= startOfToday;
  if (filter === "yesterday") return t >= startOfToday - dayMs && t < startOfToday;
  // "week": from the start of the current week (Monday) through now.
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  return t >= startOfToday - dow * dayMs;
}

export function EngagementSection() {
  const { data: rows = [], isLoading } = useRecentQuoteEngagement(10);
  const [filter, setFilter] = useState<EngagementFilter>("today");
  const [, navigate] = useLocation();

  // Most-recently-viewed quotes first; re-viewing a quote bumps it to the top.
  const sortedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => matchesFilter(r.lastViewedAt, filter))
        .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()),
    [rows, filter],
  );

  return (
    <DashboardCard className="min-w-0" testId="card-engagement">
      <div className="text-sm font-semibold">Quote Engagement</div>

      <div className="mt-3">
        <SegmentedTabs tabs={TABS} value={filter} onChange={setFilter} testIdPrefix="engagement-filter" fullWidth dense />
      </div>

      <div className="mt-4 space-y-1">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : sortedRows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No views in this period
          </div>
        ) : (
          sortedRows.map((row) => {
            const quoteHref = row.clientId
              ? `/clients/${row.clientId}/quotes/${row.quoteId}`
              : `/quotes/${row.quoteId}`;
            const hasRealClientName = row.clientName && row.clientName !== "Unknown";
            const fallbackViewerName = row.views.find((v) => v.viewerName)?.viewerName;
            const displayName = hasRealClientName
              ? row.clientName
              : fallbackViewerName || "No client linked";
            return (
              <div
                key={row.quoteId}
                role="link"
                tabIndex={0}
                onClick={() => navigate(quoteHref)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(quoteHref);
                  }
                }}
                className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                data-testid={`engagement-row-${row.quoteId}`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm font-medium ${hasRealClientName ? "" : "italic text-black/55 dark:text-white/55"}`}
                    data-testid={`engagement-client-${row.quoteId}`}
                  >
                    {displayName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#a195a5] dark:text-white/50">
                    {row.quoteTitle}
                  </div>
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
                  data-testid={`engagement-count-${row.quoteId}`}
                >
                  <span className="inline-flex items-center gap-1">
                    <View className="h-3.5 w-3.5" />
                    {row.clientViewCount}
                  </span>
                  <span className="font-medium text-sky-700/80 dark:text-sky-300/80">
                    {timeAgo(row.lastViewedAt)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
              </div>
            );
          })
        )}
      </div>
    </DashboardCard>
  );
}
