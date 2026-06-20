import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  useQuoteViews,
  useQuoteCustomerActions,
  type QuoteClientViewEntry,
  type QuotePublicViewEntry,
} from "@/features/quote/api/use-quote-share-queries";
import {
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";

interface QuoteEngagementProps {
  quoteId: string;
  className?: string;
}

function formatTimeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "—";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateTime(dateStr: string | Date | null): string {
  if (!dateStr) return "—";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at ${time}`;
}

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export function QuoteEngagement({ quoteId, className }: QuoteEngagementProps) {
  const { data: viewStats, isLoading: viewsLoading } = useQuoteViews(quoteId);
  const { data: actions, isLoading: actionsLoading } = useQuoteCustomerActions(quoteId);
  const [collapsed, setCollapsed] = useState(false);

  const isLoading = viewsLoading || actionsLoading;
  const clientViews: QuoteClientViewEntry[] = viewStats?.clientViews ?? [];
  const publicViews: QuotePublicViewEntry[] = viewStats?.publicViews ?? [];
  const publicViewCount = viewStats?.publicViewCount ?? 0;
  const uniqueViews = viewStats?.uniqueViews ?? 0;
  const hasData = clientViews.length > 0 || publicViewCount > 0 || (actions && actions.length > 0);
  const totalViews = clientViews.length + publicViewCount;

  if (isLoading) {
    return (
      <Card className={cn("rounded-3xl border-black/10 bg-white/70 p-3", className)} data-testid="card-quote-engagement">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-black/50" />
          <h3 className="text-sm font-semibold">Quote Engagement</h3>
        </div>
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5" />
        </div>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className={cn("rounded-3xl border-black/10 bg-white/70 p-3", className)} data-testid="card-quote-engagement">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-black/50" />
          <h3 className="text-sm font-semibold">Quote Engagement</h3>
        </div>
        <p className="text-xs text-black/40 text-center py-2">
          No engagement yet. Share the quote to start tracking.
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-3xl border-black/10 bg-white/70 p-3", className)} data-testid="card-quote-engagement">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        data-testid="btn-toggle-engagement"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-black/50" />
          <h3 className="text-sm font-semibold">Quote Engagement</h3>
        </div>
        <div className="flex items-center gap-2">
          {collapsed && (
            <span className="text-xs font-medium text-black/60" data-testid="text-total-views-summary">
              Viewed {totalViews} {totalViews === 1 ? "time" : "times"}
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-black/40" />
          ) : (
            <ChevronUp className="h-4 w-4 text-black/40" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="mt-3">
          {/* ── Client Views ─────────────────────────────────────────── */}
          {clientViews.length > 0 && (
            <div className="mb-3" data-testid="section-client-views">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3 w-3 text-violet-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Client Views
                </span>
              </div>
              <div
                className={cn(
                  "space-y-1.5",
                  clientViews.length >= 5 && "max-h-52 overflow-y-auto pr-1"
                )}
              >
                {clientViews.map((v) => {
                  const IconComp = deviceIcons[v.deviceType || ""] || Monitor;
                  return (
                    <div
                      key={v.id}
                      className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2"
                      data-testid={`client-view-${v.id}`}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold mt-0.5">
                        {v.viewerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-black/80">
                          {v.viewerName}
                        </span>
                        <span className="text-xs text-black/50"> viewed this quote</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <IconComp className="h-2.5 w-2.5 text-black/30" />
                          <span className="text-[10px] text-black/40">
                            {formatTimeAgo(v.viewedAt)} · {formatDateTime(v.viewedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Public Views ─────────────────────────────────────────── */}
          {publicViewCount > 0 && (
            <div className="mb-3" data-testid="section-public-views">
              <div className="flex items-center justify-between rounded-xl border border-black/5 bg-blue-50/30 px-3 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-medium" data-testid="text-public-view-count">
                    Viewed {publicViewCount} {publicViewCount === 1 ? "time" : "times"}
                  </span>
                  {uniqueViews > 0 && (
                    <span className="text-[10px] text-black/40" data-testid="text-unique-views">
                      · {uniqueViews} unique {uniqueViews === 1 ? "visitor" : "visitors"}
                    </span>
                  )}
                </div>
              </div>

              {publicViews.length > 0 && (
                <div
                  className={cn(
                    "mt-2 space-y-1",
                    publicViews.length >= 5 && "max-h-40 overflow-y-auto pr-1"
                  )}
                  data-testid="public-history-list"
                >
                  {publicViews.map((v) => {
                    const IconComp = deviceIcons[v.deviceType || ""] || Monitor;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 rounded-lg border border-black/5 bg-black/[0.02] px-2.5 py-1.5"
                        data-testid={`public-view-${v.id}`}
                      >
                        <IconComp className="h-3 w-3 shrink-0 text-black/30" />
                        <span className="text-[10px] text-black/60 flex-1">
                          {v.browser || "Unknown browser"}
                          {v.deviceType && v.deviceType !== "desktop" && (
                            <span className="text-black/40"> · {v.deviceType}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-black/40 shrink-0">
                          {formatTimeAgo(v.viewedAt)} · {formatDateTime(v.viewedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Customer Responses ───────────────────────────────────── */}
          {actions && actions.length > 0 && (
            <div className="space-y-2" data-testid="section-customer-actions">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
                Customer Responses
              </div>
              {actions.map((action: any) => (
                <div
                  key={action.id}
                  className={`rounded-xl border px-3 py-2 ${
                    action.actionType === "accepted"
                      ? "border-green-200 bg-green-50/50"
                      : "border-amber-200 bg-amber-50/50"
                  }`}
                  data-testid={`action-${action.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {action.actionType === "accepted" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <span className="text-xs font-semibold">
                      {action.actionType === "accepted" ? "Wants to Book" : "Changes Requested"}
                    </span>
                    <span className="ml-auto text-[10px] text-black/40">
                      {formatTimeAgo(action.createdAt)}
                    </span>
                  </div>
                  {action.customerName && (
                    <p className="text-[10px] text-black/50">From: {action.customerName}</p>
                  )}
                  {action.message && (
                    <p className="mt-1 text-xs text-black/70 italic">"{action.message}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
