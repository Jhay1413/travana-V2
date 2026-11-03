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
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

const DEVICE_ICON: Record<DeviceKind, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
  unknown: Eye,
};

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
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-views-h" data-testid="holiday-views-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="holiday-views-h" className="text-base font-semibold leading-snug">
            Quote views
          </h2>
          <p className="mt-0.5 text-[13px] text-qp-muted">{sentAt ? `Sent ${formatDay(sentAt)}` : "Not sent yet"}</p>
        </div>
        {stats?.lastViewed && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-qp-best">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-qp-live opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-qp-live" />
            </span>
            last viewed {timeAgo(stats.lastViewed, now)}
          </span>
        )}
      </div>

      {isError ? (
        <p className="py-5 text-center text-[13px] text-qp-muted">Views unavailable</p>
      ) : hasViews && stats ? (
        <>
          <ol>
            {views.map((v, i) => {
              const Icon = DEVICE_ICON[v.deviceKind];
              return (
                <li key={v.id} className={cn("grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 py-2.5", i > 0 && "border-t border-social-border")}>
                  <span className="grid size-8 place-items-center rounded-full bg-status-posted-bg text-status-posted-fg" aria-hidden>
                    <Icon className="size-[15px]" />
                  </span>
                  <div>
                    <b className="text-[13px] font-semibold">{viewDayLabel(v.viewedAt, now)}</b>
                    <div className="text-xs text-qp-muted">
                      {v.device} · {v.source === "client" ? (v.viewerName ?? "Client") : "Public link"} · {formatClock(v.viewedAt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="py-5 text-center text-[13px] text-qp-muted">Not opened yet.</p>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-3 border-t border-social-border pt-3" data-testid="views-customer-actions">
          <h3 className="mb-2 text-[13px] font-semibold">What the customer did</h3>
          <ul className="flex flex-col gap-1.5">
            {actions.map((a) => (
              <li key={a.id} className="text-[13px]">
                <b className="font-semibold">
                  {a.actionType === "accepted" ? "Accepted the quote" : a.actionType === "changes_requested" ? "Asked for changes" : a.actionType}
                </b>
                <span className="text-qp-muted">
                  {" "}
                  · {a.customerName || "Customer"} · {formatDay(a.createdAt)}
                </span>
                {a.message && <p className="mt-1 text-qp-muted">{a.message}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
