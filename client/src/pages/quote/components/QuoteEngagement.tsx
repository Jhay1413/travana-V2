import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuoteViews, useQuoteCustomerActions } from "@/hooks/queries/use-quote-share-queries";
import {
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

interface QuoteEngagementProps {
  quoteId: string;
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
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${time}`;
}

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export function QuoteEngagement({ quoteId }: QuoteEngagementProps) {
  const { data: viewStats, isLoading: viewsLoading } = useQuoteViews(quoteId);
  const { data: actions, isLoading: actionsLoading } = useQuoteCustomerActions(quoteId);

  const isLoading = viewsLoading || actionsLoading;
  const totalViews = viewStats?.totalViews || 0;
  const hasData = totalViews > 0 || (actions && actions.length > 0);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-engagement">
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
      <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-engagement">
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
    <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-engagement">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-black/50" />
        <h3 className="text-sm font-semibold">Quote Engagement</h3>
      </div>

      {totalViews > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-black/5 bg-blue-50/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-medium" data-testid="text-view-count">
                Viewed {totalViews} {totalViews === 1 ? "time" : "times"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2">
              <div className="text-[10px] text-black/40 mb-0.5">First viewed</div>
              <div className="font-medium text-black/70" data-testid="text-first-viewed">
                {formatDateTime(viewStats.firstViewed)}
              </div>
            </div>
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2">
              <div className="text-[10px] text-black/40 mb-0.5">Last viewed</div>
              <div className="font-medium text-black/70" data-testid="text-last-viewed">
                {formatDateTime(viewStats.lastViewed)}
              </div>
            </div>
          </div>

          {viewStats.deviceBreakdown && Object.keys(viewStats.deviceBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(viewStats.deviceBreakdown as Record<string, number>).map(([device, count]) => {
                const IconComp = deviceIcons[device] || Monitor;
                return (
                  <div
                    key={device}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[10px] font-medium text-black/60"
                    data-testid={`badge-device-${device}`}
                  >
                    <IconComp className="h-3 w-3" />
                    {device}: {count}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-3 space-y-2">
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
    </Card>
  );
}
