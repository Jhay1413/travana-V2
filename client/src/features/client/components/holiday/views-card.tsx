import { Eye, Laptop, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/features/quote/components/hooks";
import { useQuoteCustomerActions, useQuoteViews } from "@/features/quote/api/use-quote-share-queries";
import {
  formatClock,
  formatDay,
  recentViews,
  timeAgo,
  viewDayLabel,
  type DeviceKind,
} from "@/features/quote/lib/quote-views";
import { HOLIDAY_SIDE_CARD } from "@/features/client/components/holiday/holiday-styles";
import { TruncateTip } from "@/features/client/components/holiday/truncate-tip";

const DEVICE_ICON: Record<DeviceKind, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
  unknown: Eye,
};

function actionLabel(type: string): string {
  if (type === "accepted") return "Accepted the quote";
  if (type === "changes_requested") return "Asked for changes";
  return type;
}

export interface ViewsCardProps {
  quoteId: string;
  sentAt?: string | null;
}

/** "Quote views": when it was sent, how often it was opened, the ten latest views and what the customer did. */
export function ViewsCard({ quoteId, sentAt }: ViewsCardProps) {
  const now = useLiveNow();
  const { data: stats, isError } = useQuoteViews(quoteId);
  const { data: actions } = useQuoteCustomerActions(quoteId);
  const views = recentViews(stats, 10);
  const hasViews = (stats?.totalViews ?? 0) > 0;

  return (
    <section className={HOLIDAY_SIDE_CARD} aria-labelledby="holiday-views-h" data-testid="holiday-views-card">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id="holiday-views-h" className="text-[15px] font-semibold leading-snug">
            Quote views
          </h2>
          <p className="mt-0.5 text-xs text-qp-muted">{sentAt ? `Sent ${formatDay(sentAt)}` : "Not sent yet"}</p>
        </div>
        {stats?.lastViewed && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-qp-best">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-qp-live opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-qp-live" />
            </span>
            last viewed {timeAgo(stats.lastViewed, now)}
          </span>
        )}
      </div>

      {isError ? (
        <p className="py-3 text-center text-xs text-qp-muted">Views unavailable</p>
      ) : hasViews && stats ? (
        <>
          <ol>
            {views.map((v, i) => {
              const Icon = DEVICE_ICON[v.deviceKind];
              return (
                <li key={v.id} className={cn("grid grid-cols-[26px_minmax(0,1fr)] items-center gap-2 py-1.5", i > 0 && "border-t border-social-border")}>
                  <span className="grid size-[26px] place-items-center rounded-full bg-status-posted-bg text-status-posted-fg" aria-hidden>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <b className="block text-xs font-semibold">{viewDayLabel(v.viewedAt, now)}</b>
                    <TruncateTip
                      text={[v.device, v.source === "client" ? (v.viewerName ?? "Client") : "Public link", formatClock(v.viewedAt)].join(" · ")}
                      className="text-[11px] text-qp-muted"
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="py-3 text-center text-xs text-qp-muted">Not opened yet.</p>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-2.5 border-t border-social-border pt-2.5" data-testid="views-customer-actions">
          <h3 className="mb-1.5 text-xs font-semibold">What the customer did</h3>
          <ul className="flex flex-col gap-1">
            {actions.map((a) => (
              <li key={a.id} className="min-w-0 text-xs">
                <TruncateTip text={`${actionLabel(a.actionType)} · ${a.customerName || "Customer"} · ${formatDay(a.createdAt)}`}>
                  <b className="font-semibold">{actionLabel(a.actionType)}</b>
                  <span className="text-qp-muted"> · {a.customerName || "Customer"} · {formatDay(a.createdAt)}</span>
                </TruncateTip>
                {a.message && <TruncateTip text={a.message} className="mt-0.5 text-qp-muted" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
