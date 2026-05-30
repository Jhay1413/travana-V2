import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, Monitor, Smartphone, Tablet } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { useRecentQuoteEngagement } from "@/hooks/queries";
import type { QuoteEngagementView } from "@/api/endpoints/quote.api";

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

function ViewItem({ view }: { view: QuoteEngagementView }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <DeviceIcon device={view.deviceType} />
        <span className="truncate text-black/75 dark:text-white/75">
          {view.viewerName || "Unknown viewer"}
        </span>
        {view.browser && (
          <span className="text-black/40 dark:text-white/40 truncate">· {view.browser}</span>
        )}
      </div>
      <span className="shrink-0 text-black/50 dark:text-white/50">
        {formatRelative(view.viewedAt)}
      </span>
    </div>
  );
}

export function EngagementSection() {
  const { data: rows = [], isLoading } = useRecentQuoteEngagement(10);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [, navigate] = useLocation();

  if (!isLoading && rows.length === 0) return null;

  return (
    <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="card-engagement">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-black/60 dark:text-white/60" />
          <div className="text-sm font-semibold">Quote Engagement</div>
        </div>
        <div className="text-[11px] text-muted-foreground">Client views</div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-3 text-center">Loading…</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const isOpen = !!expanded[row.quoteId];
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
                className="rounded-2xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02] overflow-hidden"
                data-testid={`engagement-row-${row.quoteId}`}
              >
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
                      {row.views.map((v, i) => (
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
