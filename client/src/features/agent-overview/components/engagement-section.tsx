import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useRecentQuoteEngagement } from "@/hooks/queries";
import { dealTypeHref } from "@/lib/deal-links";
import { cn } from "@/lib/utils";
import { timeAgo } from "./dashboard-ui";
import { EmptyLine, HomeCard, HomePill, PersonAvatar, RowButton, UnderlineTabs } from "./home/home-ui";

type EngagementFilter = "today" | "yesterday" | "week" | "all";

const TABS: Array<{ value: EngagementFilter; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "all", label: "All" },
];

const LIMIT = 10;

/** Filtering happens on the server: the dashboard only ever shows the viewer's own deals, per tab. */
export function EngagementSection() {
  const [filter, setFilter] = useState<EngagementFilter>("today");
  const { data: rows = [], isLoading } = useRecentQuoteEngagement(LIMIT, {
    scope: { mine: true, period: filter },
    keepPrevious: true,
  });
  const [, navigate] = useLocation();

  // Most-recently-viewed quotes first; re-viewing a quote bumps it to the top.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()),
    [rows],
  );

  return (
    <HomeCard title="Quote Engagement" testId="card-engagement">
      <UnderlineTabs
        tabs={TABS}
        value={filter}
        onChange={setFilter}
        label="Quote engagement period"
        testIdPrefix="engagement-filter"
      />

      {isLoading ? (
        <EmptyLine>Loading…</EmptyLine>
      ) : sortedRows.length === 0 ? (
        <EmptyLine>No quote views for this period.</EmptyLine>
      ) : (
        sortedRows.map((row) => {
          const quoteHref = dealTypeHref("quote", row.quoteId, row.clientId);
          const hasRealClientName = row.clientName && row.clientName !== "Unknown";
          const fallbackViewerName = row.views.find((v) => v.viewerName)?.viewerName;
          const displayName = hasRealClientName ? row.clientName : fallbackViewerName || "No client linked";
          return (
            <RowButton
              key={row.quoteId}
              onActivate={() => navigate(quoteHref)}
              className="flex items-center gap-3 py-1.5 hover:bg-social-page"
              testId={`engagement-row-${row.quoteId}`}
            >
              <PersonAvatar name={displayName} size={38} />
              <div className="min-w-0 flex-1">
                <div
                  className={cn("truncate text-[13px] font-semibold xl:text-[14px]", !hasRealClientName && "italic text-social-muted")}
                  data-testid={`engagement-client-${row.quoteId}`}
                >
                  {displayName}
                </div>
                <div className="line-clamp-2 text-[11px] text-social-muted xl:text-[12px]">{row.quoteTitle}</div>
              </div>
              <HomePill
                className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              >
                <span data-testid={`engagement-count-${row.quoteId}`}>
                  {row.clientViewCount} {row.clientViewCount === 1 ? "view" : "views"} · {timeAgo(row.lastViewedAt)}
                </span>
              </HomePill>
            </RowButton>
          );
        })
      )}
    </HomeCard>
  );
}
