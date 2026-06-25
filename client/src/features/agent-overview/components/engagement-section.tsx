import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecentQuoteEngagement } from "@/hooks/queries";
import type { QuoteEngagementView } from "@/features/quote/api/quote.api";

type EngagementFilter = "all" | "today" | "yesterday" | "week";

// A quote viewed within this window is treated as "just viewed" and its row is
// highlighted (orange background, white text, pulsing) until the window passes.
const RECENT_VIEW_WINDOW_MS = 10 * 60_000; // 10 minutes

function isRecentlyViewed(iso: string, now: number): boolean {
  return now - new Date(iso).getTime() < RECENT_VIEW_WINDOW_MS;
}

const FILTER_OPTIONS: { value: EngagementFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
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

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function DeviceIcon({ device }: { device: string | null }) {
  const d = (device || "").toLowerCase();
  if (d.includes("mobile") || d.includes("phone")) return <Smartphone className="h-3 w-3" />;
  if (d.includes("tablet")) return <Tablet className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ViewItem({ view }: { view: QuoteEngagementView }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <DeviceIcon device={view.deviceType} />
        {view.viewerName && (
          <span className="truncate text-black/75 dark:text-white/75">{view.viewerName}</span>
        )}
        {view.browser && (
          <span className="text-black/40 dark:text-white/40 truncate">
            {view.viewerName ? "· " : ""}
            {view.browser}
          </span>
        )}
      </div>
      <span className="shrink-0 text-black/50 dark:text-white/50">
        {formatDateTime(view.viewedAt)}
      </span>
    </div>
  );
}

export function EngagementSection() {
  const { data: rows = [], isLoading } = useRecentQuoteEngagement(10);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<EngagementFilter>("all");
  const [, navigate] = useLocation();

  // Re-evaluate "recently viewed" periodically so the highlight fades out on its
  // own ~10 minutes after the last view, without needing a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Most-recently-viewed quotes first; re-viewing a quote bumps it to the top.
  const sortedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => matchesFilter(r.lastViewedAt, filter))
        .sort(
          (a, b) =>
            new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
        ),
    [rows, filter]
  );

  if (!isLoading && rows.length === 0) return null;

  return (
    <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="card-engagement">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0 text-black/60 dark:text-white/60" />
          <div className="truncate text-sm font-semibold">Quote Engagement</div>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as EngagementFilter)}>
          <SelectTrigger className="h-7 w-auto shrink-0 gap-1.5 rounded-full px-2.5 text-[11px]" data-testid="engagement-filter">
            <span className="text-muted-foreground hidden sm:inline">Filter by:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-3 text-center">Loading…</div>
      ) : sortedRows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3 text-center">No views in this period</div>
      ) : (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {sortedRows.map((row) => {
            const isOpen = !!expanded[row.quoteId];
            const sortedViews = [...row.views].sort(
              (a, b) =>
                new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
            );
            const quoteHref = row.clientId
              ? `/clients/${row.clientId}/quotes/${row.quoteId}`
              : `/quotes/${row.quoteId}`;
            const hasRealClientName = row.clientName && row.clientName !== "Unknown";
            const fallbackViewerName = row.views.find((v) => v.viewerName)?.viewerName;
            const displayName = hasRealClientName
              ? row.clientName
              : fallbackViewerName || "No client linked";
            const recentlyViewed = isRecentlyViewed(row.lastViewedAt, now);
            return (
              <div
                key={row.quoteId}
                className="relative rounded-2xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02] overflow-hidden"
                data-testid={`engagement-row-${row.quoteId}`}
              >
                {recentlyViewed && (
                  <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-red-500 animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [row.quoteId]: !s[row.quoteId] }))}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-black/45" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-black/45" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(quoteHref);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(quoteHref);
                          }
                        }}
                        className={`block text-sm font-medium truncate cursor-pointer hover:underline ${
                          hasRealClientName ? "" : "text-black/55 dark:text-white/55 italic"
                        }`}
                        data-testid={`engagement-client-${row.quoteId}`}
                      >
                        {displayName}
                      </span>
                      <div className="text-xs text-black/55 dark:text-white/55 truncate">
                        {row.quoteTitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600"
                      data-testid={`engagement-count-${row.quoteId}`}
                    >
                      <Eye className="h-3 w-3" />
                      {row.clientViewCount}
                    </span>
                    <span className="text-[11px] text-black/45 dark:text-white/45">
                      {formatRelative(row.lastViewedAt)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                    <div className="divide-y divide-black/5 dark:divide-white/5">
                      {sortedViews.map((v, i) => (
                        <ViewItem key={`${row.quoteId}-${i}`} view={v} />
                      ))}
                    </div>
                    <div className="px-3 py-2 text-right">
                      <Link
                        href={quoteHref}
                        className="text-[11px] font-medium text-blue-600 hover:underline"
                        data-testid={`engagement-open-${row.quoteId}`}
                      >
                        Open quote →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
